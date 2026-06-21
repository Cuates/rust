import type { DirStats } from '../types';
import { formatDuration } from '../utils/formatters';

export const pipeline = $state({
  consoleLogs: [] as { id: number; text: string }[],
  processingActive: false,
  showMetricsPanel: false,

  // Layout Metric Sync Parameters
  totalFilesCount: 0,
  completedFilesCount: 0,
  completedFilesPerDir: {} as Record<string, number>,
  activeFiles: {} as Record<string, number>,

  get overallProgress() {
    if (this.totalFilesCount === 0) return 0;
    let sumIntra = 0;
    for (const key in this.activeFiles) {
      sumIntra += this.activeFiles[key];
    }
    const completed = this.completedFilesCount;
    const fraction = completed + sumIntra / 100;
    const percent = (fraction / this.totalFilesCount) * 100;
    // Floor it so it doesn't say 100% until it's actually 100%
    return Math.floor(Math.min(100, Math.max(0, percent)));
  },

  get currentFileIndex() {
    return Math.min(
      this.totalFilesCount,
      this.completedFilesCount + Object.keys(this.activeFiles).length
    );
  },

  get activeTaskList() {
    return Object.entries(this.activeFiles).map(([filename, progress]) => ({
      filename,
      progress
    }));
  },

  get currentFilename() {
    const keys = Object.keys(this.activeFiles);
    return keys.length > 0 ? keys[keys.length - 1] : '';
  },

  get intraFileProgress() {
    const name = this.currentFilename;
    return name ? this.activeFiles[name] || 0 : 0;
  },

  startTime: 0,
  runningTimeFormatted: '0ms',
  etaFormatted: '--',
  storageOriginalBytes: 0,
  storageOutputBytes: 0,

  // Granular Status tracking
  directoryStatuses: {} as Record<string, 'pending' | 'processing' | 'done' | 'error' | 'skipped'>,
  directoryErrors: {} as Record<string, boolean>,
  currentActiveDirectory: null as string | null,
  directoryStats: {} as Record<string, DirStats>,
  hasProcessClicked: false
});

let timerInterval: ReturnType<typeof setInterval> | undefined = undefined;

export function startPipelineTimer() {
  if (timerInterval) clearInterval(timerInterval);
  pipeline.startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsedMs = Date.now() - pipeline.startTime;
    pipeline.runningTimeFormatted = formatDuration(elapsedMs);

    try {
      let sumIntra = 0;
      const vals = Object.values(pipeline.activeFiles);
      for (let i = 0; i < vals.length; i++) {
        sumIntra += vals[i] as number;
      }
      const completedFraction = pipeline.completedFilesCount + sumIntra / 100;

      if (
        pipeline.totalFilesCount > 0 &&
        completedFraction > 0.05 &&
        completedFraction < pipeline.totalFilesCount
      ) {
        const msPerFile = elapsedMs / completedFraction;
        const remainingFraction = pipeline.totalFilesCount - completedFraction;
        const remainingMs = remainingFraction * msPerFile;
        pipeline.etaFormatted = formatDuration(remainingMs);
      } else if (pipeline.totalFilesCount > 0 && completedFraction >= pipeline.totalFilesCount) {
        pipeline.etaFormatted = '0ms';
      } else {
        pipeline.etaFormatted = '--';
      }
    } catch (err) {
      console.error('Timer tick error:', err);
    }
  }, 100);
}

export function stopPipelineTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

import { invoke } from '@tauri-apps/api/core';
import { TAURI_COMMANDS } from '../constants';

export async function emitLog(...logs: string[]) {
  for (const log of logs) {
    await invoke(TAURI_COMMANDS.LOG_MESSAGE, { message: log });
  }
}

let logBuffer: { id: number; text: string }[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let logIdCounter = 0;

export function addLogs(...logs: string[]) {
  for (const text of logs) {
    logBuffer.push({ id: logIdCounter++, text });
  }
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      pipeline.consoleLogs.push(...logBuffer);
      if (pipeline.consoleLogs.length > 1000) {
        const overflow = pipeline.consoleLogs.length - 1000;
        pipeline.consoleLogs.splice(0, overflow);
        pipeline.consoleLogs.unshift({
          id: logIdCounter++,
          text: `— [${overflow} entries trimmed – see saved session.log] —`
        });
      }
      logBuffer = [];
      flushTimeout = null;
    }, 100);
  }
}
