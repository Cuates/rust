use serde_json::json;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use crate::constants::EVENT_PROCESS_LOG;
use crate::error::AppError;
use crate::models::{AppState, ProgressPayload, SubtitleMetadata};

// -----------------------------------------------------------------------------
// Logging Infrastructure (ported from mkv-filter-metadata)
// -----------------------------------------------------------------------------

/// Appends a log message to the frontend terminal and the session log file.
/// Performs log rotation at 10 MB.
pub fn append_log<R: tauri::Runtime>(app: &AppHandle<R>, message: impl AsRef<str>) {
    let msg = message.as_ref();

    // Route to the appropriate tracing level.
    if msg.contains("[ERROR]") || msg.contains("[FATAL]") || msg.contains('❌') {
        tracing::error!("{}", msg);
    } else if msg.starts_with("---")
        || msg.starts_with('[')
        || msg.contains("Pipeline")
        || msg.contains("Analysis complete")
        || msg.contains("Initializing")
    {
        tracing::info!("{}", msg);
    } else {
        tracing::trace!("{}", msg);
    }

    // Emit to the frontend terminal via event.
    let _ = app.emit(EVENT_PROCESS_LOG, msg);

    // Write to the buffered session log file.
    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.log_writer.lock() {
        let mut rotate = false;
        if let Some(log) = guard.as_mut() {
            let line_len = msg.len() + 1; // +1 for '\n'
            if log.bytes_written + line_len > 10 * 1024 * 1024 {
                let _ = log.writer.flush();
                rotate = true;
            } else {
                let _ = writeln!(log.writer, "{}", msg);
                log.bytes_written += line_len;
            }
        }

        if rotate {
            drop(guard.take());
            if let Ok(log_dir) = app.path().app_log_dir() {
                let log_file = log_dir.join("session.log");
                let rot1 = log_dir.join("session.1.log");
                let rot2 = log_dir.join("session.2.log");
                let _ = std::fs::remove_file(&rot2);
                let _ = std::fs::rename(&rot1, &rot2);
                let _ = std::fs::rename(&log_file, &rot1);

                if let Ok(file) = std::fs::OpenOptions::new()
                    .create(true)
                    .write(true)
                    .truncate(true)
                    .open(&log_file)
                {
                    let mut new_log = crate::models::SessionLog {
                        writer: std::io::BufWriter::new(file),
                        bytes_written: 0,
                    };
                    let _ = writeln!(new_log.writer, "--- LOG ROTATED ---");
                    let _ = writeln!(new_log.writer, "{}", msg);
                    new_log.bytes_written += 21 + msg.len() + 1;
                    *guard = Some(new_log);
                }
            }
        }
    }
}

/// Flushes the buffered log writer to disk. Must be called before reading the file.
pub fn flush_log_writer<R: tauri::Runtime>(app: &AppHandle<R>) {
    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.log_writer.lock()
        && let Some(log) = guard.as_mut()
    {
        let _ = log.writer.flush();
    }
}

// -----------------------------------------------------------------------------
// File Discovery
// -----------------------------------------------------------------------------

/// Walks the given `paths` (optionally recursively) and returns all `.mkv` files
/// paired with their parent folder path from the input list.
pub fn discover_mkv_files(paths: &[String], recursive: bool) -> Vec<(PathBuf, String)> {
    let mut results = Vec::new();

    for path_str in paths {
        let mut walker = walkdir::WalkDir::new(path_str).follow_links(false);
        if !recursive {
            walker = walker.max_depth(1);
        }

        for entry in walker.into_iter().flatten() {
            let p = entry.path();
            if p.is_file()
                && p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("mkv"))
                    .unwrap_or(false)
            {
                results.push((p.to_path_buf(), path_str.clone()));
            }
        }
    }

    results
}

// -----------------------------------------------------------------------------
// SRT → ASS Conversion Engine (fixed)
// -----------------------------------------------------------------------------

/// Strips HTML-like formatting tags commonly found in SRT files.
/// Translates italic/bold/underline to ASS override codes; strips the rest.
pub fn strip_srt_html(text: &str) -> String {
    // Translation table for common SRT formatting tags → ASS override codes.
    static RE_ITALIC_OPEN: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)<i>").unwrap());
    static RE_ITALIC_CLOSE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)</i>").unwrap());
    static RE_BOLD_OPEN: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)<b>").unwrap());
    static RE_BOLD_CLOSE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)</b>").unwrap());
    static RE_UNDERLINE_OPEN: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)<u>").unwrap());
    static RE_UNDERLINE_CLOSE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"(?i)</u>").unwrap());
    static RE_REMAINING_TAGS: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"<[^>]+>").unwrap());

    let s = RE_ITALIC_OPEN.replace_all(text, "{\\\\i1}");
    let s = RE_ITALIC_CLOSE.replace_all(&s, "{\\\\i0}");
    let s = RE_BOLD_OPEN.replace_all(&s, "{\\\\b1}");
    let s = RE_BOLD_CLOSE.replace_all(&s, "{\\\\b0}");
    let s = RE_UNDERLINE_OPEN.replace_all(&s, "{\\\\u1}");
    let s = RE_UNDERLINE_CLOSE.replace_all(&s, "{\\\\u0}");
    // Strip all remaining unrecognised HTML-like tags.
    RE_REMAINING_TAGS.replace_all(&s, "").to_string()
}

/// Converts an SRT timestamp string (`HH:MM:SS,mmm`) to ASS format (`H:MM:SS.cc`).
/// Uses proper delimiter splitting instead of fragile byte-index slicing.
pub fn format_srt_time_to_ass(srt_time: &str) -> String {
    let srt_time = srt_time.trim();

    // SRT format: HH:MM:SS,mmm  →  ASS format: H:MM:SS.cc
    if let Some((time_part, ms_str)) = srt_time.split_once(',') {
        let parts: Vec<&str> = time_part.split(':').collect();
        if parts.len() == 3 {
            let hours = parts[0].parse::<u32>().unwrap_or(0);
            let minutes = parts[1];
            let seconds = parts[2];
            // ASS uses centiseconds (2 digits), SRT uses milliseconds (3 digits).
            let centiseconds = ms_str.get(..2).unwrap_or("00");
            return format!("{}:{}:{}.{}", hours, minutes, seconds, centiseconds);
        }
    }

    srt_time.to_string()
}

/// Converts a SubRip (SRT) file to an Advanced SubStation Alpha (ASS) file.
/// Strips HTML formatting tags and translates them to ASS override codes.
/// Returns an error if the SRT file cannot be read or the ASS file cannot be written.
/// Returns `false` if the conversion produced no dialogue events (empty subtitle track).
pub fn convert_srt_to_ass(input_path: &Path, output_path: &Path) -> std::io::Result<bool> {
    let file = std::fs::File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut ass_file = std::fs::File::create(output_path)?;
    let mut dialogue_count = 0u32;

    // Write ASS header.
    writeln!(ass_file, "[Script Info]")?;
    writeln!(ass_file, "ScriptType: v4.00+")?;
    writeln!(ass_file, "WrapStyle: 0")?;
    writeln!(ass_file, "ScaledBorderAndShadow: yes")?;
    writeln!(ass_file)?;
    writeln!(ass_file, "[V4+ Styles]")?;
    writeln!(
        ass_file,
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, \
         Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, \
         Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
    )?;
    writeln!(
        ass_file,
        "Style: Default,Trebuchet MS,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,\
         0,0,0,0,100,100,0,0,1,1.0,1.0,2,10,10,10,1"
    )?;
    writeln!(ass_file)?;
    writeln!(ass_file, "[Events]")?;
    writeln!(
        ass_file,
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    )?;

    let mut lines = reader.lines().map_while(Result::ok).peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // A sequence number line: parse the following timecode and text.
        if trimmed.parse::<u32>().is_ok()
            && let Some(time_line) = lines.next()
            && time_line.contains("-->")
        {
            let parts: Vec<&str> = time_line.splitn(2, "-->").collect();
            if parts.len() == 2 {
                let start = format_srt_time_to_ass(parts[0].trim());
                let end = format_srt_time_to_ass(parts[1].trim());

                // Collect all text lines for this cue.
                let mut text = String::new();
                while let Some(next_line) = lines.peek() {
                    let next_trimmed = next_line.trim();
                    if next_trimmed.is_empty() || next_trimmed.parse::<u32>().is_ok() {
                        break;
                    }
                    if let Some(actual_line) = lines.next() {
                        if !text.is_empty() {
                            text.push_str("\\N");
                        }
                        text.push_str(&strip_srt_html(&actual_line));
                    }
                }

                writeln!(
                    ass_file,
                    "Dialogue: 0,{},{},Default,,0,0,0,,{}",
                    start, end, text
                )?;
                dialogue_count += 1;
            }
        }
    }

    Ok(dialogue_count > 0)
}

// -----------------------------------------------------------------------------
// FFprobe — Subtitle Stream Discovery
// -----------------------------------------------------------------------------

/// A parsed subtitle stream entry returned by FFprobe.
pub struct SubtitleStream {
    pub index: u32,
    pub codec: String,
    pub language: String,
    pub title: String,
    pub default_flag: i64,
    pub forced_flag: i64,
}

/// Runs FFprobe on `file_path` and returns all detected subtitle streams.
pub async fn run_ffprobe_subtitle_streams<R: tauri::Runtime>(
    app: &AppHandle<R>,
    file_path: &Path,
) -> Result<Vec<SubtitleStream>, AppError> {
    let sidecar = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    let output = sidecar
        .args([
            "-v",
            "error",
            "-select_streams",
            "s",
            "-show_entries",
            "stream=index,codec_name:stream_tags=language,title:disposition=default,forced",
            "-of",
            "json",
            &file_path.to_string_lossy(),
        ])
        .output()
        .await
        .map_err(|e| AppError::FfprobeFailed(e.to_string()))?;

    let parsed: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::FfprobeFailed(e.to_string()))?;

    let mut streams = Vec::new();
    if let Some(arr) = parsed["streams"].as_array() {
        for stream in arr {
            if let Some(idx) = stream["index"].as_u64() {
                let codec = stream["codec_name"]
                    .as_str()
                    .unwrap_or("subrip")
                    .to_string();
                let mut lang = stream["tags"]["language"]
                    .as_str()
                    .unwrap_or("und")
                    .to_string();
                if lang.trim().is_empty() {
                    lang = "und".to_string();
                }
                let title = stream["tags"]["title"].as_str().unwrap_or("").to_string();
                let default_flag = stream["disposition"]["default"].as_i64().unwrap_or(0);
                let forced_flag = stream["disposition"]["forced"].as_i64().unwrap_or(0);

                streams.push(SubtitleStream {
                    index: idx as u32,
                    codec,
                    language: lang,
                    title,
                    default_flag,
                    forced_flag,
                });
            }
        }
    }

    Ok(streams)
}

// -----------------------------------------------------------------------------
// FFmpeg — Subtitle Track Extraction
// -----------------------------------------------------------------------------

/// Runs FFmpeg to extract a single subtitle stream from `input_mkv` into `output_srt`.
/// Registers the `CommandChild` in `AppState` so it can be killed on cancellation.
/// Returns `true` if extraction succeeded (exit code 0).
pub async fn run_ffmpeg_extract_subtitle<R: tauri::Runtime>(
    app: &AppHandle<R>,
    input_mkv: &Path,
    stream_index: u32,
    output_srt: &Path,
    cancel_token: &tokio_util::sync::CancellationToken,
) -> Result<bool, AppError> {
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    let map_arg = format!("0:{}", stream_index);
    let (mut rx, child) = sidecar
        .args([
            "-y",
            "-i",
            &input_mkv.to_string_lossy(),
            "-map",
            &map_arg,
            &output_srt.to_string_lossy(),
        ])
        .spawn()
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    // Register the child process for kill-on-cancel.
    {
        let state = app.state::<AppState>();
        let mut session = state.process.lock().await;
        session.children.insert(output_srt.to_path_buf(), child);
    }

    let mut success = false;

    while let Some(event) = rx.recv().await {
        if cancel_token.is_cancelled() {
            // Child will be killed by abort_mkv_directory_processing.
            return Err(AppError::Aborted);
        }
        if let CommandEvent::Terminated(payload) = event {
            success = payload.code == Some(0);
            break;
        }
    }

    // Deregister the child now that it has terminated.
    {
        let state = app.state::<AppState>();
        let mut session = state.process.lock().await;
        session.children.remove(&output_srt.to_path_buf());
    }

    Ok(success)
}

// -----------------------------------------------------------------------------
// Single-File Processing
// -----------------------------------------------------------------------------

/// Processes one MKV file: probes subtitle streams, extracts each subrip track
/// via FFmpeg, converts to ASS, and returns the per-file success/failure lists.
///
/// Skips files already recorded in the SQLite history database.
pub async fn process_one_mkv_file<R: tauri::Runtime>(
    app: &AppHandle<R>,
    file_path: &Path,
    root_dir: &str,
    cancel_token: &tokio_util::sync::CancellationToken,
    on_progress: &tauri::ipc::Channel<ProgressPayload>,
    files_processed: &Arc<AtomicUsize>,
    tracks_converted: &Arc<AtomicUsize>,
) -> Result<(Vec<SubtitleMetadata>, Vec<String>), AppError> {
    if cancel_token.is_cancelled() {
        return Err(AppError::Aborted);
    }

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.mkv")
        .to_string();
    let file_stem = file_path
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("video")
        .to_string();
    let output_dir = file_path.parent().unwrap_or_else(|| Path::new("."));

    // --- History check ---
    let path_str = file_path.to_string_lossy().to_string();
    let (original_size, modified_ts) = std::fs::metadata(file_path)
        .map(|m| {
            let size = m.len();
            let ts = m
                .modified()
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            (size, ts)
        })
        .unwrap_or((0, 0));

    {
        let already_done = tokio::task::spawn_blocking({
            let app_clone = app.clone();
            let path_clone = path_str.clone();
            move || {
                let st = app_clone.state::<AppState>();
                let guard = st.db.blocking_lock();
                if let Some(db) = guard.as_ref() {
                    crate::history::is_file_processed(db, &path_clone, original_size, modified_ts)
                        .unwrap_or(false)
                } else {
                    false
                }
            }
        })
        .await
        .unwrap_or(false);

        if already_done {
            append_log(
                app,
                format!("⏭️  Skipping previously converted file: {}", file_name),
            );
            let processed = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
            let converted = tracks_converted.load(Ordering::Relaxed);
            let _ = on_progress.send(ProgressPayload {
                event: "FileProcessed".into(),
                data: json!({ "processed": processed, "converted": converted }),
            });
            // Return empty lists — no new conversions, no failures.
            return Ok((Vec::new(), Vec::new()));
        }
    }

    append_log(app, format!("🔍 Probing: {}", file_name));

    // --- FFprobe ---
    let streams = match run_ffprobe_subtitle_streams(app, file_path).await {
        Ok(s) => s,
        Err(e) => {
            append_log(
                app,
                format!("  | [ERROR] FFprobe failed for {}: {}", file_name, e),
            );
            let processed = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
            let converted = tracks_converted.load(Ordering::Relaxed);
            let _ = on_progress.send(ProgressPayload {
                event: "FileProcessed".into(),
                data: json!({ "processed": processed, "converted": converted }),
            });
            return Ok((Vec::new(), vec![format!("FFprobe failed: {}", file_name)]));
        }
    };

    // Log and filter unsupported codecs.
    let supported_codecs = ["subrip", "ass", "ssa"];
    for stream in &streams {
        if !supported_codecs.contains(&stream.codec.as_str()) {
            append_log(
                app,
                format!(
                    "  ℹ Skipping unsupported codec '{}' on stream {} in {}",
                    stream.codec, stream.index, file_name
                ),
            );
        }
    }

    let valid_tracks: Vec<_> = streams
        .into_iter()
        .filter(|s| s.codec == "subrip") // Only subrip → ASS pipeline for now.
        .collect();

    if valid_tracks.is_empty() {
        append_log(
            app,
            format!("  ℹ No convertible subtitle tracks in {}", file_name),
        );
        let processed = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
        let converted = tracks_converted.load(Ordering::Relaxed);
        let _ = on_progress.send(ProgressPayload {
            event: "FileProcessed".into(),
            data: json!({ "processed": processed, "converted": converted }),
        });
        return Ok((Vec::new(), Vec::new()));
    }

    let mut conv_list: Vec<SubtitleMetadata> = Vec::new();
    let mut fail_list: Vec<String> = Vec::new();

    // --- Extract each valid track ---
    for stream in valid_tracks {
        if cancel_token.is_cancelled() {
            return Err(AppError::Aborted);
        }

        let sanitized_title = if stream.title.trim().is_empty() {
            "unnamed".to_string()
        } else {
            stream
                .title
                .replace(|c: char| !c.is_alphanumeric() && c != '_', "_")
        };

        let base_name = format!(
            "{}_track{}_{}_default{}_forced{}",
            file_stem, stream.index, sanitized_title, stream.default_flag, stream.forced_flag
        );
        let srt_filename = format!("{}_extracted.srt", base_name);
        let ass_filename = format!("{}.{}.ass", base_name, stream.language);

        let tmp_srt_path = output_dir.join(&srt_filename);
        let final_ass_path = output_dir.join(&ass_filename);

        // Register session files for safe cleanup on abort.
        {
            let state = app.state::<AppState>();
            let mut session = state.process.lock().await;
            session.session_output_files.push(tmp_srt_path.clone());
            session.session_output_files.push(final_ass_path.clone());
        }

        // Extract SRT via FFmpeg.
        let extraction_ok = match run_ffmpeg_extract_subtitle(
            app,
            file_path,
            stream.index,
            &tmp_srt_path,
            cancel_token,
        )
        .await
        {
            Ok(ok) => ok,
            Err(AppError::Aborted) => return Err(AppError::Aborted),
            Err(e) => {
                append_log(
                    app,
                    format!(
                        "  | [ERROR] FFmpeg extraction error on stream {}: {}",
                        stream.index, e
                    ),
                );
                fail_list.push(format!(
                    "FFmpeg error on stream {}: {}",
                    stream.index, file_name
                ));
                continue;
            }
        };

        if !extraction_ok {
            append_log(
                app,
                format!(
                    "  | [ERROR] FFmpeg extraction failed for stream {} in {}",
                    stream.index, file_name
                ),
            );
            fail_list.push(format!(
                "Extraction failed on stream {}: {}",
                stream.index, file_name
            ));
            if tmp_srt_path.exists() {
                let _ = std::fs::remove_file(&tmp_srt_path);
            }
            continue;
        }

        // Convert SRT → ASS.
        let had_dialogue = match convert_srt_to_ass(&tmp_srt_path, &final_ass_path) {
            Ok(has_content) => has_content,
            Err(e) => {
                append_log(
                    app,
                    format!(
                        "  | [ERROR] ASS conversion failed for stream {}: {}",
                        stream.index, e
                    ),
                );
                fail_list.push(format!(
                    "ASS conversion failed on stream {}: {}",
                    stream.index, file_name
                ));
                if tmp_srt_path.exists() {
                    let _ = std::fs::remove_file(&tmp_srt_path);
                }
                continue;
            }
        };

        // Clean up the temporary SRT file.
        if tmp_srt_path.exists() {
            let _ = std::fs::remove_file(&tmp_srt_path);
        }

        if had_dialogue {
            let count = tracks_converted.fetch_add(1, Ordering::Relaxed) + 1;
            append_log(
                app,
                format!(
                    "✓ Converted stream {} [lang: {}] → {}",
                    stream.index, stream.language, ass_filename
                ),
            );
            let processed = files_processed.load(Ordering::Relaxed);
            let _ = on_progress.send(ProgressPayload {
                event: "FileProcessed".into(),
                data: json!({
                    "processed": processed,
                    "converted": count,
                    "file_completed": file_name,
                    "root_directory": root_dir
                }),
            });
            conv_list.push(SubtitleMetadata {
                file: ass_filename,
                language: stream.language.clone(),
                track_name: if stream.title.is_empty() {
                    format!("Track {}", stream.index)
                } else {
                    stream.title.clone()
                },
                codec: stream.codec.clone(),
            });
        } else {
            append_log(
                app,
                format!(
                    "  ℹ Stream {} in {} produced an empty subtitle track — skipped.",
                    stream.index, file_name
                ),
            );
            // Remove the empty ASS file.
            if final_ass_path.exists() {
                let _ = std::fs::remove_file(&final_ass_path);
            }
        }
    }

    // Increment processed file counter after all tracks are done.
    let processed = files_processed.fetch_add(1, Ordering::Relaxed) + 1;
    let converted = tracks_converted.load(Ordering::Relaxed);
    let _ = on_progress.send(ProgressPayload {
        event: "FileProcessed".into(),
        data: json!({
            "processed": processed,
            "converted": converted,
            "file_completed": file_name,
            "root_directory": root_dir
        }),
    });

    // Mark this file as processed in the history DB if at least one track succeeded.
    if !conv_list.is_empty() {
        let app_clone = app.clone();
        let path_clone = path_str.clone();
        tokio::task::spawn_blocking(move || {
            let st = app_clone.state::<AppState>();
            let guard = st.db.blocking_lock();
            if let Some(db) = guard.as_ref() {
                let _ = crate::history::mark_file_processed(
                    db,
                    &path_clone,
                    original_size,
                    modified_ts,
                );
            }
        })
        .await
        .ok();
    }

    Ok((conv_list, fail_list))
}
