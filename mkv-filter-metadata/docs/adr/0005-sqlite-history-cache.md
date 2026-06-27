---
date: 2026-06-26
status: "accepted"
author: "AI Assistant"
---

# 5. SQLite Processing History Cache

## Context

Users often run batch processing on massive directories containing hundreds of gigabytes of video. If a user interrupts the process, or if they add a few new files to a directory and re-run the job, it is highly inefficient to have FFprobe scan and FFmpeg re-process files that were already successfully converted.

## Decision

We introduced a local SQLite database (using `rusqlite` bundled) to track the processing history. 
Upon successful processing, the backend records the file's absolute path, original size, and last modified time. 
When a directory is queued, the backend queries this database and automatically skips any file that matches an existing record and has not been modified since the record was created.

## Consequences

- **Positive:** Massive performance boost for resuming aborted queues or updating previously processed directories (idempotent runs).
- **Positive:** `rusqlite` bundled compilation ensures the database engine works flawlessly across all OS targets without requiring the user to install SQLite.
- **Negative:** Adds statefulness to the application, requiring a UI mechanism to clear the history if the user intentionally wants to force a re-process of everything.
