import type { PipelineStatus, FinishedData } from '$lib/types';

interface PipelineState {
  status: PipelineStatus;
  totalFiles: number;
  filesProcessed: number;
  tracksConverted: number;
  logs: string[];
  elapsedSeconds: number;
  elapsedMs: number;
  successReportDir: string;
  failureReportDir: string;
  largeBatchWarning: boolean;
  directoryStatuses: Record<string, string>;
  folderCounts: Record<string, number>;
  completedFilesPerDir: Record<string, number>;
  filesSucceeded: number;
  filesFailed: number;
  filesSkipped: number;
  filesNoTracks: number;
}

export const pipeline = $state<PipelineState>({
  status: 'idle',
  totalFiles: 0,
  filesProcessed: 0,
  tracksConverted: 0,
  logs: [],
  elapsedSeconds: 0,
  elapsedMs: 0,
  successReportDir: '',
  failureReportDir: '',
  largeBatchWarning: false,
  directoryStatuses: {},
  folderCounts: {},
  completedFilesPerDir: {},
  filesSucceeded: 0,
  filesFailed: 0,
  filesSkipped: 0,
  filesNoTracks: 0
});

let pipelineTimer: ReturnType<typeof setInterval> | null = null;
let pipelineStartTime: number = 0;

export function startPipelineTimer(): void {
  if (pipelineTimer) clearInterval(pipelineTimer);
  pipelineStartTime = Date.now();
  pipelineTimer = setInterval(() => {
    const diff = Date.now() - pipelineStartTime;
    pipeline.elapsedSeconds = Math.floor(diff / 1000);
    pipeline.elapsedMs = diff % 1000;
  }, 100);
}

export function stopPipelineTimer(): void {
  if (pipelineTimer) {
    clearInterval(pipelineTimer);
    pipelineTimer = null;
  }
}

export function resetPipeline(): void {
  stopPipelineTimer();
  pipeline.status = 'idle';
  pipeline.totalFiles = 0;
  pipeline.filesProcessed = 0;
  pipeline.tracksConverted = 0;
  pipeline.logs = [];
  pipeline.elapsedSeconds = 0;
  pipeline.elapsedMs = 0;
  pipeline.successReportDir = '';
  pipeline.failureReportDir = '';
  pipeline.largeBatchWarning = false;
  pipeline.directoryStatuses = {};
  pipeline.folderCounts = {};
  pipeline.completedFilesPerDir = {};
  pipeline.filesSucceeded = 0;
  pipeline.filesFailed = 0;
  pipeline.filesSkipped = 0;
  pipeline.filesNoTracks = 0;
}

export function appendLog(message: string): void {
  pipeline.logs.push(message);
  // Cap log at 2000 lines to prevent memory bloat on very large batches.
  if (pipeline.logs.length > 2000) {
    pipeline.logs.shift();
  }
}

export function handleStartedScanned(total: number, folderCounts?: Record<string, number>): void {
  pipeline.status = 'processing';
  pipeline.totalFiles = total;
  if (folderCounts) {
    pipeline.folderCounts = folderCounts;
  }
}

export function handleFileProcessed(processed: number, converted: number, rootDir?: string): void {
  pipeline.filesProcessed = processed;
  pipeline.tracksConverted = converted;
  if (rootDir) {
    pipeline.completedFilesPerDir[rootDir] = (pipeline.completedFilesPerDir[rootDir] || 0) + 1;
  }
}

export function handleFinished(data: FinishedData): void {
  stopPipelineTimer();
  pipeline.status = 'done';
  pipeline.elapsedSeconds = data.seconds ?? 0;
  pipeline.elapsedMs = data.milliseconds ?? 0;
  pipeline.successReportDir = data.success_file ?? '';
  pipeline.failureReportDir = data.failure_file ?? '';
  if (data.folder_statuses) {
    pipeline.directoryStatuses = data.folder_statuses;
  }
  pipeline.filesSucceeded = data.succeeded_files ?? 0;
  pipeline.filesFailed = data.failed_files ?? 0;
  pipeline.filesSkipped = data.skipped_files ?? 0;
  pipeline.filesNoTracks = data.no_tracks_files ?? 0;
}

export function handleCancelled(): void {
  stopPipelineTimer();
  pipeline.status = 'cancelled';
}

export function handleFolderStatusUpdate(folder: string, status: string): void {
  pipeline.directoryStatuses[folder] = status;
}
