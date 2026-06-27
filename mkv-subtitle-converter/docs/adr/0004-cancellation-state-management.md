# 4. Cancellation State Management

Date: 2026-06-27

## Status

Accepted

## Context

During a recent project audit, an issue was raised regarding how we handle the cancellation of long-running, multi-file MKV subtitle extractions. Our backend features an `abort_mkv_directory_processing` command. The initial audit suggested that this abort command should physically clear the `session.active_paths` set directly to forcefully stop processing and reset the state.

However, modifying the session state concurrently from the abort command can introduce severe race conditions. The primary processing loop (`process_mkv_directory`) relies on the integrity of `active_paths` to manage its iterative lifecycle and clean up temporary files (e.g., `converted_files.json`).

## Decision

We will strictly enforce the separation of cancellation signaling and physical state cleanup.

1. **Signaling Only**: The `abort_mkv_directory_processing` command must act purely as a signal trigger. It uses a `tokio_util::sync::CancellationToken` to notify the system that a cancellation has been requested. It does **not** mutate the shared file tracking state (`active_paths`).
2. **Lifecycle Responsibility**: The core `process_mkv_directory` function loop remains the sole owner of the session state. It checks `cancel_token.is_cancelled()` during each iteration. Upon detecting a cancellation, the loop gracefully exits, runs its unified cleanup routines (which include clearing `active_paths`), and exits safely.

## Consequences

- **Positive**: Eliminates potential race conditions and unpredictable state mutations when aborting jobs. Guarantees that all required physical cleanup routines (like deleting temporary JSON lists) are guaranteed to run before the system resets.
- **Negative**: There may be a slight, imperceptible delay between the user clicking "Cancel" and the actual state being cleared, as the system waits for the current loop iteration to yield to the token check.
