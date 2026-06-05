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
  directoryStatuses: {} as Record<string, 'pending' | 'processing' | 'done' | 'error'>,
  directoryErrors: {} as Record<string, boolean>,
  currentActiveDirectory: null as string | null,
  directoryStats: {} as Record<string, DirStats>,
  hasProcessClicked: false
});
