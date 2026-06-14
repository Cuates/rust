import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pipeline, emitLog, addLogs } from './pipeline.svelte';
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
});
