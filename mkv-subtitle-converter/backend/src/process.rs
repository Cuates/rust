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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileOutcome {
    HistorySkipped,
    NoTracks,
    Processed,
}

// -----------------------------------------------------------------------------
// Logging Infrastructure
// -----------------------------------------------------------------------------

pub fn append_log<R: tauri::Runtime>(app: &AppHandle<R>, message: impl AsRef<str>) {
    let msg = message.as_ref();

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

    let _ = app.emit(EVENT_PROCESS_LOG, msg);

    let state = app.state::<AppState>();
    if let Ok(mut guard) = state.log_writer.lock() {
        let mut rotate = false;
        if let Some(log) = guard.as_mut() {
            let line_len = msg.len() + 1;
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
                    let rotation_msg = "--- LOG ROTATED ---";
                    let _ = writeln!(new_log.writer, "{}", rotation_msg);
                    let _ = writeln!(new_log.writer, "{}", msg);
                    new_log.bytes_written += rotation_msg.len() + 1 + msg.len() + 1;
                    *guard = Some(new_log);
                }
            }
        }
    }
}

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
// SRT → ASS Conversion Engine
// -----------------------------------------------------------------------------

pub fn strip_srt_html(text: &str) -> String {
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

    let s = RE_ITALIC_OPEN.replace_all(text, "{\\i1}");
    let s = RE_ITALIC_CLOSE.replace_all(&s, "{\\i0}");
    let s = RE_BOLD_OPEN.replace_all(&s, "{\\b1}");
    let s = RE_BOLD_CLOSE.replace_all(&s, "{\\b0}");
    let s = RE_UNDERLINE_OPEN.replace_all(&s, "{\\u1}");
    let s = RE_UNDERLINE_CLOSE.replace_all(&s, "{\\u0}");
    RE_REMAINING_TAGS.replace_all(&s, "").to_string()
}

pub fn format_srt_time_to_ass(srt_time: &str) -> String {
    let srt_time = srt_time.trim();

    if let Some((time_part, ms_str)) = srt_time.split_once(',') {
        let parts: Vec<&str> = time_part.split(':').collect();
        if parts.len() == 3 {
            let hours = parts[0].parse::<u32>().unwrap_or(0);
            let minutes = parts[1];
            let seconds = parts[2];
            let centiseconds = ms_str.get(..2).unwrap_or("00");
            return format!("{}:{}:{}.{}", hours, minutes, seconds, centiseconds);
        }
    }

    srt_time.to_string()
}

pub fn convert_srt_to_ass(input_path: &Path, output_path: &Path) -> std::io::Result<bool> {
    let file = std::fs::File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut ass_file = std::io::BufWriter::new(std::fs::File::create(output_path)?);
    let mut dialogue_count = 0u32;

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

        if trimmed.parse::<u32>().is_ok()
            && let Some(time_line) = lines.next()
            && time_line.contains("-->")
        {
            let parts: Vec<&str> = time_line.splitn(2, "-->").collect();
            if parts.len() == 2 {
                let start = format_srt_time_to_ass(parts[0].trim());
                let end = format_srt_time_to_ass(parts[1].trim());

                let mut text = String::new();
                while let Some(next_line) = lines.peek() {
                    let next_trimmed = next_line.trim();
                    if next_trimmed.is_empty() {
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

    ass_file.flush()?;
    Ok(dialogue_count > 0)
}

// -----------------------------------------------------------------------------
// FFprobe — Subtitle Stream Discovery
// -----------------------------------------------------------------------------

#[derive(Clone)]
pub struct SubtitleStream {
    pub index: u32,
    pub codec: String,
    pub language: String,
    pub title: String,
    pub default_flag: i64,
    pub forced_flag: i64,
}

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

pub async fn run_ffmpeg_extract_subtitle<R: tauri::Runtime>(
    app: &AppHandle<R>,
    input_mkv: &Path,
    stream_index: u32,
    output_srt: Option<&Path>,
    final_ass_path: &Path,
    cancel_token: &tokio_util::sync::CancellationToken,
) -> Result<bool, AppError> {
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    let map_arg = format!("0:{}", stream_index);
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input_mkv.to_string_lossy().into_owned(),
        "-map".to_string(),
        map_arg,
    ];
    let tracking_path = if let Some(srt) = output_srt {
        args.push(srt.to_string_lossy().into_owned());
        srt.to_path_buf()
    } else {
        args.push("-c:s".to_string());
        args.push("copy".to_string());
        args.push(final_ass_path.to_string_lossy().into_owned());
        final_ass_path.to_path_buf()
    };

    let (mut rx, child) = sidecar
        .args(args)
        .spawn()
        .map_err(|e| AppError::Sidecar(e.to_string()))?;

    {
        let state = app.state::<AppState>();
        let mut session = state.process.lock().await;
        session.children.insert(tracking_path.clone(), child);
        if let Some(srt) = output_srt {
            session.session_output_files.push(srt.to_path_buf());
        }
        session
            .session_output_files
            .push(final_ass_path.to_path_buf());
    }

    let mut success = false;

    while let Some(event) = rx.recv().await {
        if cancel_token.is_cancelled() {
            return Err(AppError::Aborted);
        }
        if let CommandEvent::Terminated(payload) = event {
            success = payload.code == Some(0);
            break;
        }
    }

    Ok(success)
}

// -----------------------------------------------------------------------------
// Single-File Processing
// -----------------------------------------------------------------------------

type HistorySet = std::collections::HashSet<(String, u64, u64)>;

pub struct ProcessContext<'a, R: tauri::Runtime> {
    pub app: &'a AppHandle<R>,
    pub file_path: &'a Path,
    pub root_dir: &'a str,
    pub cancel_token: &'a tokio_util::sync::CancellationToken,
    pub on_progress: &'a tauri::ipc::Channel<ProgressPayload>,
    pub files_processed: &'a Arc<AtomicUsize>,
    pub tracks_converted: &'a Arc<AtomicUsize>,
    pub history_cache: &'a Arc<HistorySet>,
    pub new_history_records: &'a Arc<tokio::sync::Mutex<HistorySet>>,
}

pub async fn process_one_mkv_file<R: tauri::Runtime>(
    ctx: ProcessContext<'_, R>,
) -> Result<(Vec<SubtitleMetadata>, Vec<String>, FileOutcome), AppError> {
    let ProcessContext {
        app,
        file_path,
        root_dir,
        cancel_token,
        on_progress,
        files_processed,
        tracks_converted,
        history_cache,
        new_history_records,
    } = ctx;

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

    let path_str = file_path.to_string_lossy().to_string();
    let (original_size, modified_ts) = match tokio::fs::metadata(file_path).await {
        Ok(m) => {
            let size = m.len();
            let ts = m
                .modified()
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                .duration_since(std::time::SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            (size, ts)
        }
        Err(_) => (0, 0),
    };

    if history_cache.contains(&(path_str.clone(), original_size, modified_ts)) {
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
        return Ok((Vec::new(), Vec::new(), FileOutcome::HistorySkipped));
    }

    append_log(app, format!("🔍 Probing: {}", file_name));

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
            return Ok((
                Vec::new(),
                vec![format!("FFprobe failed: {}", file_name)],
                FileOutcome::Processed,
            ));
        }
    };

    let supported_codecs = ["subrip"];
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
        .filter(|s| supported_codecs.contains(&s.codec.as_str()))
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
        return Ok((Vec::new(), Vec::new(), FileOutcome::NoTracks));
    }

    let mut join_set = tokio::task::JoinSet::new();

    for stream in valid_tracks {
        let app_clone = app.clone();
        let file_path_clone = file_path.to_path_buf();
        let file_stem_clone = file_stem.clone();
        let file_name_clone = file_name.clone();
        let output_dir_clone = output_dir.to_path_buf();
        let cancel_token_clone = cancel_token.clone();

        join_set.spawn(async move {
            if cancel_token_clone.is_cancelled() {
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
                file_stem_clone,
                stream.index,
                sanitized_title,
                stream.default_flag,
                stream.forced_flag
            );
            let srt_filename = format!("{}_extracted.srt", base_name);
            let ass_filename = format!("{}.{}.ass", base_name, stream.language);

            let tmp_srt_path = output_dir_clone.join(&srt_filename);
            let final_ass_path = output_dir_clone.join(&ass_filename);
            let is_ass = stream.codec == "ass" || stream.codec == "ssa";

            let extraction_ok = run_ffmpeg_extract_subtitle(
                &app_clone,
                &file_path_clone,
                stream.index,
                if is_ass { None } else { Some(&tmp_srt_path) },
                &final_ass_path,
                &cancel_token_clone,
            )
            .await?;

            if !extraction_ok {
                if !is_ass {
                    tokio::fs::remove_file(&tmp_srt_path).await.ok();
                }
                let err_msg = format!(
                    "Extraction failed on stream {}: {}",
                    stream.index, file_name_clone
                );
                return Ok(Err((stream, err_msg)));
            }

            let had_dialogue = if is_ass {
                true
            } else {
                let tmp_srt_path_clone = tmp_srt_path.clone();
                let final_ass_path_clone = final_ass_path.clone();

                let conversion_res = tokio::task::spawn_blocking(move || {
                    convert_srt_to_ass(&tmp_srt_path_clone, &final_ass_path_clone)
                })
                .await;

                match conversion_res {
                    Ok(Ok(has_content)) => has_content,
                    Ok(Err(e)) => {
                        tokio::fs::remove_file(&tmp_srt_path).await.ok();
                        let err_msg =
                            format!("ASS conversion failed on stream {}: {}", stream.index, e);
                        return Ok(Err((stream, err_msg)));
                    }
                    Err(e) => {
                        tokio::fs::remove_file(&tmp_srt_path).await.ok();
                        let err_msg =
                            format!("Spawn blocking failed on stream {}: {}", stream.index, e);
                        return Ok(Err((stream, err_msg)));
                    }
                }
            };

            if !is_ass {
                tokio::fs::remove_file(&tmp_srt_path).await.ok();
            }

            if had_dialogue {
                {
                    let state = app_clone.state::<AppState>();
                    let mut session = state.process.lock().await;
                    session
                        .session_output_files
                        .retain(|p| p != &tmp_srt_path && p != &final_ass_path);
                }

                Ok(Ok((stream, ass_filename)))
            } else {
                tokio::fs::remove_file(&final_ass_path).await.ok();
                Ok(Err((
                    stream,
                    "Stream produced an empty subtitle track — skipped.".to_string(),
                )))
            }
        });
    }

    let mut conv_list: Vec<SubtitleMetadata> = Vec::new();
    let mut fail_list: Vec<String> = Vec::new();

    while let Some(res) = join_set.join_next().await {
        match res {
            Ok(Ok(Ok((stream, ass_filename)))) => {
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
                        "file_completed": file_name.clone(),
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
            }
            Ok(Ok(Err((stream, err_msg)))) => {
                if err_msg.contains("empty subtitle track") {
                    append_log(
                        app,
                        format!("  ℹ Stream {} in {} {}", stream.index, file_name, err_msg),
                    );
                } else {
                    append_log(app, format!("  | [ERROR] {}", err_msg));
                    fail_list.push(err_msg);
                }
            }
            Ok(Err(AppError::Aborted)) => return Err(AppError::Aborted),
            Ok(Err(e)) => {
                fail_list.push(format!("Internal error: {}", e));
            }
            Err(e) => {
                fail_list.push(format!("Task join error: {}", e));
            }
        }
    }

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

    if !conv_list.is_empty() {
        new_history_records
            .lock()
            .await
            .insert((path_str, original_size, modified_ts));
    }

    Ok((conv_list, fail_list, FileOutcome::Processed))
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_srt_time_to_ass() {
        assert_eq!(format_srt_time_to_ass("01:23:45,678"), "1:23:45.67");
        assert_eq!(format_srt_time_to_ass("00:01:02,050"), "0:01:02.05");
        assert_eq!(format_srt_time_to_ass("bad_time"), "bad_time");
    }

    #[test]
    fn test_strip_srt_html() {
        assert_eq!(strip_srt_html("<i>Hello</i>"), "{\\i1}Hello{\\i0}");
        assert_eq!(strip_srt_html("<b>World</b>"), "{\\b1}World{\\b0}");
        assert_eq!(strip_srt_html("<u>Under</u>"), "{\\u1}Under{\\u0}");
        assert_eq!(strip_srt_html("<font color=\"red\">Color</font>"), "Color");
        assert_eq!(
            strip_srt_html("<i><b>Both</b></i>"),
            "{\\i1}{\\b1}Both{\\b0}{\\i0}"
        );
    }

    #[test]
    fn test_discover_mkv_files() {
        let temp = tempfile::tempdir().unwrap();
        let mkv1 = temp.path().join("1.mkv");
        let mkv2 = temp.path().join("2.MKV");
        let txt1 = temp.path().join("1.txt");
        let sub = temp.path().join("sub");
        std::fs::create_dir(&sub).unwrap();
        let mkv3 = sub.join("3.mkv");

        std::fs::File::create(&mkv1).unwrap();
        std::fs::File::create(&mkv2).unwrap();
        std::fs::File::create(&txt1).unwrap();
        std::fs::File::create(&mkv3).unwrap();

        let paths = vec![temp.path().to_string_lossy().into_owned()];

        let non_recursive = discover_mkv_files(&paths, false);
        assert_eq!(non_recursive.len(), 2);

        let recursive = discover_mkv_files(&paths, true);
        assert_eq!(recursive.len(), 3);
    }
}
