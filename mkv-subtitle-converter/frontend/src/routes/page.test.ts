import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { invoke, Channel } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import Page from './+page.svelte';
import { config } from '$lib/stores/config.svelte';
import { resetPipeline, pipeline } from '$lib/stores/pipeline.svelte';
import type { IpcPayloadData } from '$lib/types/ipc';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_directory_stats') {
      return Promise.resolve({ exists: true, file_count: 0, total_size_bytes: 0, files: [] });
    }
    return Promise.resolve({});
  }),
  Channel: class MockChannel<T> {
    onmessage: ((message: T) => void) | undefined;
    constructor() {}
  }
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    setProgressBar: vi.fn()
  }),
  ProgressBarStatus: {
    None: 'none',
    Normal: 'normal'
  }
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: vi.fn().mockReturnValue({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {})
  })
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue(null)
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn().mockResolvedValue(null)
}));

describe('+page.svelte', () => {
  beforeEach(() => {
    config.input_directories = [];
    resetPipeline();
    vi.clearAllMocks();
  });

  it('renders the header and main layout', () => {
    render(Page);
    expect(screen.getByText('MKV Subtitle Extractor')).toBeInTheDocument();
    expect(
      screen.getByText('Batch-convert embedded subtitle tracks to ASS format')
    ).toBeInTheDocument();
    expect(screen.getByText('Start Conversion')).toBeInTheDocument();
  });

  it('Start Conversion is disabled when queue is empty', () => {
    render(Page);
    const startBtn = screen.getByText('Start Conversion');
    expect(startBtn.closest('button')).toBeDisabled();
  });

  it('Start Conversion is enabled when queue has items', async () => {
    config.input_directories = ['/path/to/movies'];
    render(Page);

    const startBtn = screen.getByText('Start Conversion');
    expect(startBtn.closest('button')).not.toBeDisabled();
  });

  it('clicking Start Conversion invokes process_mkv_directory', async () => {
    config.input_directories = ['/path/to/movies'];
    render(Page);

    // Setup invoke mock to return a valid finished payload
    vi.mocked(invoke).mockResolvedValueOnce({
      success_file: '',
      failure_file: '',
      seconds: 1,
      milliseconds: 0,
      folder_statuses: {},
      succeeded_files: 1,
      failed_files: 0,
      skipped_files: 0,
      no_tracks_files: 0
    });

    const startBtn = screen.getByText('Start Conversion');
    await fireEvent.click(startBtn);

    expect(invoke).toHaveBeenCalledWith(
      'process_mkv_directory',
      expect.objectContaining({
        paths: ['/path/to/movies']
      })
    );
  });

  it('renders Stop button when processing and aborts when clicked', async () => {
    config.input_directories = ['/path/to/movies'];
    pipeline.status = 'processing';

    render(Page);

    const stopBtn = screen.getByText(/Stop/i);
    expect(stopBtn).toBeInTheDocument();

    await fireEvent.click(stopBtn);
    expect(invoke).toHaveBeenCalledWith('abort_mkv_directory_processing');
  });

  it('opens dialog when Add Folder shortcut or icon is clicked', async () => {
    // We cannot easily test the shortcut without complex event mocking that Svelte captures on window,
    // but we can test the effect by mocking open dialog if we could click the button,
    // wait, there is no direct Add Folder button on +page.svelte, it's inside DirectoryQueue
    // let's simulate open being called inside DirectoryQueue by rendering it implicitly
    render(Page);

    vi.mocked(open).mockResolvedValueOnce('/test/folder');

    const addFolderBtn = screen.getByText('Add Folder');
    await fireEvent.click(addFolderBtn);

    expect(open).toHaveBeenCalledWith({ directory: true, multiple: true });

    await waitFor(() => {
      expect(config.input_directories).toContain('/test/folder');
    });
  });

  it('opens About modal when About button is clicked', async () => {
    render(Page);
    const aboutBtn = screen.getByTitle('About (F1)');
    await fireEvent.click(aboutBtn);

    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('MKV Subtitle Extractor Converter')).toBeInTheDocument();
  });

  it('opens Clear History modal and invokes clear command on confirm', async () => {
    render(Page);
    const clearBtn = screen.getByTitle('Clear Processing History');
    await fireEvent.click(clearBtn);

    expect(screen.getByText('Clear Processing History')).toBeInTheDocument();

    // Check that we can confirm the modal
    const confirmBtn = screen.getByText('Clear History');
    await fireEvent.click(confirmBtn);

    expect(invoke).toHaveBeenCalledWith('clear_processing_history');
  });

  it('handles IPC events from channel correctly', async () => {
    config.input_directories = ['/path'];
    let capturedChannel: Channel<IpcPayloadData> | undefined;

    vi.mocked(invoke).mockImplementation((cmd, args) => {
      if (cmd === 'get_directory_stats') {
        return Promise.resolve({ exists: true, file_count: 0, total_size_bytes: 0, files: [] });
      }
      if (cmd === 'process_mkv_directory') {
        capturedChannel = (args as { onProgress: Channel<IpcPayloadData> }).onProgress;
        return Promise.resolve({
          success_file: '',
          failure_file: '',
          seconds: 0,
          milliseconds: 0,
          folder_statuses: {},
          succeeded_files: 0,
          failed_files: 0,
          skipped_files: 0,
          no_tracks_files: 0
        });
      }
      return Promise.resolve({});
    });

    render(Page);

    const startBtn = screen.getByText('Start Conversion');
    await fireEvent.click(startBtn);

    expect(capturedChannel).toBeDefined();

    // Trigger IPC events
    capturedChannel?.onmessage?.({
      type: 'startedScanned',
      payload: { totalCount: 1, folderCounts: {} }
    });
    capturedChannel?.onmessage?.({
      type: 'fileProcessed',
      payload: { processed: 1, converted: 1, rootDirectory: '/path', fileCompleted: 'test.mkv' }
    });
    capturedChannel?.onmessage?.({
      type: 'folderStatusUpdate',
      payload: { folder: '/path', status: 'completed' }
    });
    capturedChannel?.onmessage?.({ type: 'cancelled', payload: 'user aborted' });

    expect(pipeline.status).toBe('cancelled');
  });
});
