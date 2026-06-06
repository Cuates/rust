import type { DirStats } from '../types';

export const pipeline = $state({
  consoleLogs: [] as string[],
  processingActive: false,
  showMetricsPanel: false,

  // Layout Metric Sync Parameters
  currentFileIndex: 0,
  totalFilesCount: 0,
  overallProgress: 0,
  intraFileProgress: 0,
  currentFilename: '',
  runningTimeFormatted: '0ms',

  // Granular Status tracking
  directoryStatuses: {} as Record<string, 'pending' | 'processing' | 'done' | 'error' | 'skipped'>,
  directoryErrors: {} as Record<string, boolean>,
  currentActiveDirectory: null as string | null,
  directoryStats: {} as Record<string, DirStats>,
  hasProcessClicked: false,
  _scrollTimeout: null as ReturnType<typeof setTimeout> | null
});

import { invoke } from '@tauri-apps/api/core';

export async function emitLog(...logs: string[]) {
  for (const log of logs) {
    await invoke('log_message', { message: log });
  }
}

let logBuffer: string[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;

export function addLogs(...logs: string[]) {
  logBuffer.push(...logs);
  if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      pipeline.consoleLogs.push(...logBuffer);
      if (pipeline.consoleLogs.length > 1000) {
        pipeline.consoleLogs.splice(0, pipeline.consoleLogs.length - 1000);
      }
      logBuffer = [];
      flushTimeout = null;
    }, 100);
  }
}
