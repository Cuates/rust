import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pipeline,
  resetPipeline,
  startPipelineTimer,
  stopPipelineTimer,
  handleFinished,
  handleCancelled,
  appendLog,
  handleStartedScanned,
  handleFileProcessed,
  handleFolderStatusUpdate
} from './pipeline.svelte';

describe('Pipeline Store Timer', () => {
  beforeEach(() => {
    resetPipeline();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts and ticks the pipeline timer correctly', () => {
    const startTime = Date.now();
    vi.setSystemTime(startTime);

    startPipelineTimer();

    // Advance timers by exactly 2500ms (2 seconds and 500ms)
    vi.advanceTimersByTime(2500);

    expect(pipeline.elapsedSeconds).toBe(2);
    expect(pipeline.elapsedMs).toBe(500);

    stopPipelineTimer();
  });

  it('stops the timer when explicitly requested', () => {
    const startTime = Date.now();
    vi.setSystemTime(startTime);
    startPipelineTimer();

    vi.advanceTimersByTime(1000);
    expect(pipeline.elapsedSeconds).toBe(1);

    stopPipelineTimer();

    vi.advanceTimersByTime(1000);
    expect(pipeline.elapsedSeconds).toBe(1);
  });

  it('stops the timer automatically on reset', () => {
    const startTime = Date.now();
    vi.setSystemTime(startTime);
    startPipelineTimer();
    vi.advanceTimersByTime(1000);

    resetPipeline();

    vi.advanceTimersByTime(1000);
    expect(pipeline.elapsedSeconds).toBe(0);
  });

  it('stops the timer automatically when finished', () => {
    const startTime = Date.now();
    vi.setSystemTime(startTime);
    startPipelineTimer();
    vi.advanceTimersByTime(1000);

    handleFinished({
      seconds: 1,
      milliseconds: 0,
      folder_statuses: {},
      succeeded_files: 1,
      failed_files: 0,
      skipped_files: 0,
      success_file: '',
      failure_file: ''
    });

    vi.advanceTimersByTime(1000);
    expect(pipeline.elapsedSeconds).toBe(1);
  });

  it('stops the timer automatically when cancelled', () => {
    const startTime = Date.now();
    vi.setSystemTime(startTime);
    startPipelineTimer();
    vi.advanceTimersByTime(1000);

    handleCancelled();

    vi.advanceTimersByTime(1000);
    expect(pipeline.elapsedSeconds).toBe(1);
  });

  it('appends logs and caps at 2000 lines', () => {
    appendLog('Test log 1');
    expect(pipeline.logs.length).toBe(1);
    expect(pipeline.logs[0]).toBe('Test log 1');

    // Add 2001 more logs
    for (let i = 0; i < 2001; i++) {
      appendLog(`Log ${i}`);
    }

    // Should cap at exactly 2000 lines
    expect(pipeline.logs.length).toBe(2000);
    // The first one "Test log 1" should have been pushed out
    expect(pipeline.logs[0]).toBe('Log 1');
    expect(pipeline.logs[1999]).toBe('Log 2000');
  });

  it('handles started scanned events', () => {
    handleStartedScanned(10);
    expect(pipeline.status).toBe('processing');
    expect(pipeline.totalFiles).toBe(10);
    expect(pipeline.folderCounts).toEqual({});

    handleStartedScanned(20, { '/test': 20 });
    expect(pipeline.totalFiles).toBe(20);
    expect(pipeline.folderCounts).toEqual({ '/test': 20 });
  });

  it('handles file processed events', () => {
    handleFileProcessed(1, 1);
    expect(pipeline.filesProcessed).toBe(1);
    expect(pipeline.tracksConverted).toBe(1);
    expect(pipeline.completedFilesPerDir).toEqual({});

    handleFileProcessed(2, 2, '/test');
    expect(pipeline.filesProcessed).toBe(2);
    expect(pipeline.completedFilesPerDir).toEqual({ '/test': 1 });

    handleFileProcessed(3, 3, '/test');
    expect(pipeline.completedFilesPerDir).toEqual({ '/test': 2 });
  });

  it('handles folder status updates', () => {
    handleFolderStatusUpdate('/test', 'processing');
    expect(pipeline.directoryStatuses).toEqual({ '/test': 'processing' });
  });
});
