# Backend Layer (Rust)

This directory contains the Tauri v2 / Rust native system execution backend layer.

## Backend Pipeline Details

### Processing Flow

```
Input Directory
  → Walk directory tree (recursive)
  → Filter by file extension
  → For each file:
      → FFprobe: inspect streams, identify subtitle tracks by language
      → Build command (FFmpeg or MKVMerge)
      → Execute sidecar (HW-Accelerated FFmpeg for transcode/remux, or MKVMerge for muxing)
      → Stream stderr/output for progress parsing
      → On subtitle incompatibility → auto-retry with ASS conversion or MKVMerge fallback
      → On success → emit progress event to frontend
      → On failure → log error, continue to next file
  → Emit completion summary with storage metrics
```

### Abort & Cleanup Protocol

When the user clicks "Stop Execution" or closes the window mid-pipeline:
1. The `is_aborted` atomic flag is set.
2. The active FFmpeg child process is forcefully killed.
3. The partially written output file is deleted from disk.
4. Empty `processed_files/` directories are removed.

### Supported Video Encoders

| Encoder | Hardware | Presets |
|---------|----------|---------|
| `libx264` | CPU (Software) | ultrafast → veryslow |
| `libx265` | CPU (Software) | ultrafast → veryslow |
| `hevc_nvenc` | NVIDIA GPU | p1 → p7 |
| `h264_nvenc` | NVIDIA GPU | p1 → p7 |
| `av1_nvenc` | NVIDIA GPU | p1 → p7 |
| `hevc_amf` | AMD GPU | speed, balanced, quality |
| `h264_amf` | AMD GPU | speed, balanced, quality |
| `av1_amf` | AMD GPU | speed, balanced, quality |
| `hevc_qsv` | Intel iGPU | (default) |
| `h264_qsv` | Intel iGPU | (default) |
| `av1_qsv` | Intel iGPU | (default) |
| `hevc_videotoolbox` | Apple Silicon | (default) |
| `h264_videotoolbox` | Apple Silicon | (default) |
| `av1_videotoolbox` | Apple Silicon | (default) |

---

## Configuration & Capabilities

### `tauri.conf.json`

Defines the application window, CSP security policy, sidecar binaries, bundle targets, and plugin configuration.

### `capabilities/default.json`

Tauri v2's capability-based security model. The application requests only the permissions it needs:
- `core:default` — Basic Tauri runtime
- `dialog:allow-open`, `dialog:allow-save` — File/folder picker dialogs
- `shell:allow-execute` — Sidecar binary execution (FFmpeg, FFprobe, MKVMerge)
- `opener:default`, `opener:allow-open-path` — Open folders in file explorer
- `notification:default` — Native OS notifications
- `core:window:allow-close`, `core:window:allow-destroy`, `core:window:allow-set-theme` — Window management
