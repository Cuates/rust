import { z } from 'zod';

// -----------------------------------------------------------------------------
// Progress Channel Payloads
// -----------------------------------------------------------------------------

export const FileProcessedDataSchema = z.object({
  processed: z.number(),
  converted: z.number(),
  file_completed: z.string().optional(),
  root_directory: z.string().optional()
});

export const FinishedDataSchema = z.object({
  success_file: z.string().optional().catch(''),
  failure_file: z.string().optional().catch(''),
  seconds: z.number().optional().catch(0),
  milliseconds: z.number().optional().catch(0),
  folder_statuses: z.record(z.string(), z.string()).optional().catch({})
});
export type FinishedData = z.infer<typeof FinishedDataSchema>;

// -----------------------------------------------------------------------------
// Subtitle Metadata (conversion success record)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Folder Report Status
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Directory Stats
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// App Config (persisted via tauri-plugin-store)
// -----------------------------------------------------------------------------

export interface AppConfig {
  input_directories: string[];
  recursive: boolean;
  save_queue_list: boolean;
  concurrency: number;
  shortcuts: Record<string, string>;
}

export const DEFAULT_CONFIG: AppConfig = {
  input_directories: [],
  recursive: false,
  save_queue_list: false,
  concurrency: 2,
  shortcuts: {
    addFolder: 'Ctrl+o',
    startConversion: 'Ctrl+Enter',
    stopConversion: 'Escape',
    resetQueue: 'Ctrl+r',
    openAbout: 'F1',
    openSettings: 'Ctrl+,'
  }
};

// -----------------------------------------------------------------------------
// Pipeline Processing State
// -----------------------------------------------------------------------------

export type PipelineStatus = 'idle' | 'scanning' | 'processing' | 'done' | 'cancelled';
