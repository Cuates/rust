import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pipeline,
  emitLog,
  addLogs,
  startPipelineTimer,
  stopPipelineTimer
} from './pipeline.svelte';
import { invoke } from '@tauri-apps/api/core';
import { TAURI_COMMANDS } from '../constants';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('pipeline.svelte', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    // reset state
    pipeline.consoleLogs = [];
    pipeline.processingActive = false;
    pipeline.showMetricsPanel = false;
    pipeline.totalFilesCount = 0;
    pipeline.completedFilesCount = 0;
    pipeline.completedFilesPerDir = {};
    pipeline.activeFiles = {};
    pipeline.runningTimeFormatted = '0ms';
    pipeline.etaFormatted = '--';
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;
    pipeline.directoryStatuses = {};
    pipeline.directoryErrors = {};
    pipeline.currentActiveDirectory = null;
    pipeline.directoryStats = {};
    pipeline.hasProcessClicked = false;
  });

  afterEach(() => {
    stopPipelineTimer();
    vi.useRealTimers();
  });

  it('overallProgress should calculate correctly', () => {
    expect(pipeline.overallProgress).toBe(0);

    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 2;
    expect(pipeline.overallProgress).toBe(20);

    pipeline.activeFiles = { 'file1.mkv': 50, 'file2.mkv': 25 };
    // 2 completed + (0.5 + 0.25) active = 2.75 / 10 = 27.5% -> floored to 27%
    expect(pipeline.overallProgress).toBe(27);
  });

  it('currentFileIndex should be correct', () => {
    expect(pipeline.currentFileIndex).toBe(0);
    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 3;
    pipeline.activeFiles = { a: 10, b: 20 };
    expect(pipeline.currentFileIndex).toBe(5);
  });

  it('activeTaskList should map active files', () => {
    pipeline.activeFiles = { fileA: 10, fileB: 90 };
    expect(pipeline.activeTaskList).toEqual([
      { filename: 'fileA', progress: 10 },
      { filename: 'fileB', progress: 90 }
    ]);
  });

  it('currentFilename should return the last active file', () => {
    expect(pipeline.currentFilename).toBe('');
    pipeline.activeFiles = { f1: 10, f2: 20 };
    expect(pipeline.currentFilename).toBe('f2');
  });

  it('intraFileProgress should return progress of current file', () => {
    expect(pipeline.intraFileProgress).toBe(0);
    pipeline.activeFiles = { f1: 10, f2: 85 };
    expect(pipeline.intraFileProgress).toBe(85);

    // Test falsy branch: when progress is exactly 0
    pipeline.activeFiles = { f3: 0 };
    expect(pipeline.intraFileProgress).toBe(0);
  });

  it('emitLog should call invoke', async () => {
    await emitLog('test 1', 'test 2');
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.LOG_MESSAGE, { message: 'test 1' });
    expect(invoke).toHaveBeenCalledWith(TAURI_COMMANDS.LOG_MESSAGE, { message: 'test 2' });
  });

  it('addLogs should buffer and flush logs', () => {
    addLogs('log 1');
    addLogs('log 2');
    expect(pipeline.consoleLogs.length).toBe(0);

    vi.advanceTimersByTime(100);
    expect(pipeline.consoleLogs.length).toBe(2);
    expect(pipeline.consoleLogs[0].text).toBe('log 1');
    expect(pipeline.consoleLogs[1].text).toBe('log 2');
  });

  it('addLogs should trim logs over 1000 entries', () => {
    for (let i = 0; i < 1005; i++) {
      addLogs(`log ${i}`);
    }
    vi.advanceTimersByTime(100);

    // It keeps 1000 real entries + 1 trimmed message
    expect(pipeline.consoleLogs.length).toBe(1001);
    expect(pipeline.consoleLogs[0].text).toContain('trimmed');
    expect(pipeline.consoleLogs[1].text).toBe('log 5');
  });

  it('startPipelineTimer should update running time formatting', () => {
    vi.setSystemTime(new Date(1000000000000));
    startPipelineTimer();

    vi.advanceTimersByTime(100);
    expect(pipeline.runningTimeFormatted).toBe('100ms');

    vi.advanceTimersByTime(900);
    expect(pipeline.runningTimeFormatted).toBe('1s 0ms');
  });

  it('startPipelineTimer should calculate ETA correctly', () => {
    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 5;
    pipeline.activeFiles = {}; // exactly 50% done

    vi.setSystemTime(new Date(1000000000000));
    startPipelineTimer();

    // Advance 5 seconds. 50% done in 5 seconds means 5 seconds remaining.
    vi.advanceTimersByTime(5000);

    expect(pipeline.etaFormatted).toBe('5s 0ms');
  });

  it('startPipelineTimer should compute sumIntra and set ETA to 0ms when exactly complete', () => {
    pipeline.totalFilesCount = 2;
    pipeline.completedFilesCount = 1;
    pipeline.activeFiles = { 'file.mkv': 100 }; // 1 + 100% = 2 = total

    vi.setSystemTime(new Date(1000000000000));
    startPipelineTimer();

    vi.advanceTimersByTime(100);
    // eta should be 0ms since it hit 100% completion
    expect(pipeline.etaFormatted).toBe('0ms');
  });

  it('startPipelineTimer should catch and log errors during tick', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force an error by mocking Object.values to throw
    const originalObjectValues = Object.values;
    Object.values = vi.fn().mockImplementation(() => {
      throw new Error('Simulated error');
    });

    vi.setSystemTime(new Date(1000000000000));
    startPipelineTimer();

    vi.advanceTimersByTime(100);

    expect(consoleSpy).toHaveBeenCalledWith('Timer tick error:', expect.any(Error));

    // Cleanup
    Object.values = originalObjectValues;
    consoleSpy.mockRestore();
  });

  it('stopPipelineTimer should stop updating running time', () => {
    vi.setSystemTime(new Date(1000000000000));
    startPipelineTimer();

    vi.advanceTimersByTime(100);
    expect(pipeline.runningTimeFormatted).toBe('100ms');

    stopPipelineTimer();

    vi.advanceTimersByTime(100);
    expect(pipeline.runningTimeFormatted).toBe('100ms');
  });
});
