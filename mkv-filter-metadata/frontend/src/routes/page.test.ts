import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import { mockIPC } from '@tauri-apps/api/mocks';
import { TAURI_COMMANDS } from '../lib/constants';
import Page from './+page.svelte';
import { config, configState } from '../lib/stores/config.svelte';
import { pipeline } from '../lib/stores/pipeline.svelte';
import { shortcuts } from '../lib/stores/shortcuts.svelte';
import { toastState } from '../lib/stores/toast.svelte';
import { filterCommands } from '../lib/stores/commands.svelte';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { UI_STRINGS } from '$lib/constants';

const { eventHandlers, windowHandlers } = vi.hoisted(() => {
  return {
    eventHandlers: {} as Record<string, (...args: unknown[]) => void>,
    windowHandlers: {
      onCloseRequested: null as ((...args: unknown[]) => void) | null,
      setProgressBar: vi.fn().mockResolvedValue(undefined)
    }
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    onCloseRequested: vi.fn((cb) => {
      windowHandlers.onCloseRequested = cb;
      return Promise.resolve(vi.fn());
    }),
    listen: vi.fn(() => Promise.resolve(vi.fn())),
    setProgressBar: windowHandlers.setProgressBar,
    destroy: vi.fn()
  }))
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event, handler) => {
    eventHandlers[event] = handler;
    return Promise.resolve(vi.fn());
  })
}));

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(false),
  requestPermission: vi.fn().mockResolvedValue('granted'),
  sendNotification: vi.fn()
}));

describe('Main Page (+page.svelte)', () => {
  beforeEach(() => {
    // Reset stores
    config.input_directories = [];
    config.notifications = true; // Test notification branch
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = false;
    pipeline.directoryStats = {};
    shortcuts.startPipeline = 'Ctrl+Enter';
    shortcuts.abortPipeline = 'Escape';

    mockIPC((cmd, args) => {
      if (cmd === TAURI_COMMANDS.GET_ENCODER_CAPABILITIES) {
        return { nvenc: true, amf: false, qsv: false, videotoolbox: false };
      }
      if (cmd === TAURI_COMMANDS.GET_SIDECAR_VERSION) {
        if ((args as Record<string, unknown>).binaryName === 'ffmpeg') return '1.0.0';
        throw new Error('Not found'); // test catch block
      }
      if (cmd === TAURI_COMMANDS.GET_DIRECTORY_STATS) {
        const dir = (args as Record<string, unknown>).dirPath;
        if (dir === '/mock/error') {
          throw new Error('Stats error');
        }
        if (dir === '/mock/missing') {
          return {
            exists: false,
            file_count: 0,
            total_size_bytes: 0,
            files: [],
            history_skipped_count: 0,
            history_skipped_bytes: 0
          };
        }
        if (dir === '/mock/empty') {
          return {
            exists: true,
            file_count: 0,
            total_size_bytes: 0,
            files: [],
            history_skipped_count: 0,
            history_skipped_bytes: 0
          };
        }
        return {
          exists: true,
          file_count: 5,
          total_size_bytes: 1000,
          files: [],
          history_skipped_count: 0,
          history_skipped_bytes: 0
        };
      }
      if (cmd === TAURI_COMMANDS.PROCESS_VIDEO_PIPELINE) {
        const payload = (args as Record<string, unknown>).payload as {
          input_directories: string[];
        };
        if (payload && payload.input_directories.includes('/mock/error-strict')) {
          throw new Error('Strict Type Error Message');
        }
        return {
          message: 'Success',
          original_size_bytes: 2000,
          output_size_bytes: 1000,
          skipped_files: 0
        };
      }
      if (cmd === TAURI_COMMANDS.ABORT_VIDEO_PIPELINE) {
        if (config.crf === 98) throw new Error('Abort Error');
        return null;
      }
      if (cmd === TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY) {
        if (config.crf === 99) throw new Error('DB Error'); // Mock error state based on crf
        return null;
      }
      return null;
    });
  });

  afterEach(() => {
    // Don't call clearMocks() as it destroys window.__TAURI_INTERNALS__ causing async leaks to fail
    vi.clearAllMocks();
  });

  it('renders without crashing', async () => {
    const { container } = render(Page);
    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('handles executePipeline with no directories', async () => {
    const { getByText } = render(Page);
    await waitFor(() => expect(getByText('Start Processing')).toBeInTheDocument());
    await fireEvent.click(getByText('Start Processing'));
    // Should add a warning toast to the store
    await waitFor(() =>
      expect(
        toastState.toasts.some((t) =>
          t.message.includes('Please add at least one target directory')
        )
      ).toBe(true)
    );
  });

  it('handles abortPipeline', async () => {
    const { getByText } = render(Page);
    await waitFor(() => expect(getByText('Start Processing')).toBeInTheDocument());

    // Force active state to reveal abort button
    pipeline.processingActive = true;

    await waitFor(() =>
      expect(getByText((content) => content.includes('Stop Execution'))).toBeInTheDocument()
    );
    await fireEvent.click(getByText((content) => content.includes('Stop Execution')));

    await waitFor(() => {
      expect(toastState.toasts.some((t) => t.message.includes('Halt instruction issued'))).toBe(
        true
      );
    });
  });

  it('handles keyboard shortcuts for pipeline', async () => {
    config.input_directories = ['/mock/dir'];
    render(Page);

    await waitFor(() => expect(pipeline.processingActive).toBe(false));

    // Test start pipeline
    await fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(pipeline.hasProcessClicked).toBe(true);
    });

    // Test abort pipeline
    pipeline.processingActive = true;
    await fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(toastState.toasts.some((t) => t.message.includes('Halt instruction issued'))).toBe(
        true
      );
    });
  });

  it('handles clearHistory execution and errors', async () => {
    const { getByRole, getByText } = render(Page);

    // Wait for $effect to register commands
    await new Promise((r) => setTimeout(r, 50));

    // Trigger modal via command
    const allCmds = filterCommands('');
    const clearCmd = allCmds.find((c) => c.id === 'clear-history');
    if (clearCmd && clearCmd.action) clearCmd.action();

    await waitFor(() =>
      expect(
        getByText((content) =>
          content.includes(UI_STRINGS.CLEAR_HISTORY_CONFIRMATION.split('\n')[0])
        )
      ).toBeInTheDocument()
    );

    // Click Cancel first
    const cancelBtn = getByText('Cancel');
    await fireEvent.click(cancelBtn);

    // Trigger modal again
    if (clearCmd && clearCmd.action) clearCmd.action();
    await waitFor(() =>
      expect(
        getByText((content) =>
          content.includes(UI_STRINGS.CLEAR_HISTORY_CONFIRMATION.split('\n')[0])
        )
      ).toBeInTheDocument()
    );

    // Click confirm
    const confirmBtn = getByRole('button', { name: /Clear History/i });
    await fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(
        toastState.toasts.some((t) =>
          t.message.includes('Processing history cleared successfully.')
        )
      ).toBe(true)
    );
  });

  it('handles window close request during processing', async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    let closeCallback: ((arg: { preventDefault: () => void }) => Promise<void>) | null = null;
    // @ts-expect-error mocking tauri
    getCurrentWindow.mockImplementation(() => ({
      onCloseRequested: vi.fn((cb) => {
        closeCallback = cb;
        return Promise.resolve(vi.fn());
      }),
      listen: vi.fn(() => Promise.resolve(vi.fn())),
      setProgressBar: windowHandlers.setProgressBar,
      destroy: vi.fn()
    }));

    render(Page);
    await waitFor(() => expect(closeCallback).not.toBeNull());

    pipeline.processingActive = true;

    // Trigger close callback
    const preventDefault = vi.fn();
    await closeCallback!({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
  });

  it('handles various Tauri events successfully', async () => {
    render(Page);
    // Wait for mount to finish registering events
    await new Promise((r) => setTimeout(r, 50));

    expect(eventHandlers['process-log']).toBeDefined();

    if (eventHandlers['process-log'])
      eventHandlers['process-log']({ payload: ['Test Log Message'] });
    if (eventHandlers['process-log'])
      eventHandlers['process-log']({ payload: ['Scanned file total: 10'] });

    if (eventHandlers['process-progress'])
      eventHandlers['process-progress']({
        payload: {
          file_completed: 'file1.mkv',
          root_directory: '/mock/dir',
          success: false,
          intra_progress: 50,
          current_filename: 'file2.mkv',
          total_files: 10,
          active_directory: '/mock/dir'
        }
      });

    if (eventHandlers['large-batch-warning'])
      eventHandlers['large-batch-warning']({ payload: 5000 });
    if (eventHandlers['db-init-failed']) eventHandlers['db-init-failed']({ payload: 'Disk full' });

    if (eventHandlers['resource-throttle'])
      eventHandlers['resource-throttle']({
        payload: { throttled: true, cpu_percent: 99, available_memory_percent: 1 }
      });
    if (eventHandlers['resource-throttle'])
      eventHandlers['resource-throttle']({
        payload: { throttled: false, cpu_percent: 50, available_memory_percent: 20 }
      });

    if (eventHandlers['tauri://drag-enter']) eventHandlers['tauri://drag-enter']();
    if (eventHandlers['tauri://drag-leave']) eventHandlers['tauri://drag-leave']();
    if (eventHandlers['tauri://drag-drop'])
      eventHandlers['tauri://drag-drop']({ payload: { paths: ['/mock/drag/dir'] } });

    await waitFor(() => {
      expect(pipeline.totalFilesCount).toBe(10);
    });
  });

  it('handles component lifecycle effects (progress bar and dir checks)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    if (!window.__TAURI_INTERNALS__) window.__TAURI_INTERNALS__ = {};
    window.__TAURI_INTERNALS__.metadata = {};

    configState.isLoaded = true;
    config.input_directories = ['/mock/valid', '/mock/error'];

    render(Page);
    await new Promise((r) => setTimeout(r, 50));

    const allCmds = filterCommands('');
    const startCmd = allCmds.find((c) => c.id === 'start-pipeline');
    const stopCmd = allCmds.find((c) => c.id === 'stop-pipeline');
    const clearCmd = allCmds.find((c) => c.id === 'clear-history');
    const aboutCmd = allCmds.find((c) => c.id === 'toggle-about');

    if (startCmd && startCmd.enabled) startCmd.enabled();
    if (stopCmd && stopCmd.enabled) stopCmd.enabled();
    if (clearCmd && clearCmd.enabled) clearCmd.enabled();
    if (aboutCmd && aboutCmd.enabled) aboutCmd.enabled();

    // We only trigger actions that don't block the test
    if (aboutCmd && aboutCmd.action) aboutCmd.action();
    if (clearCmd && clearCmd.action) clearCmd.action();

    // Simulate pipeline processing to trigger progress bar effect
    pipeline.totalFilesCount = 10;
    pipeline.processingActive = true;
    pipeline.completedFilesCount = 5; // 50%

    await waitFor(() => {
      expect(windowHandlers.setProgressBar).toHaveBeenCalled();
    });

    pipeline.completedFilesCount = 10; // 100%
    await waitFor(() => {
      expect(windowHandlers.setProgressBar).toHaveBeenCalledWith({ status: 'none' });
    });

    pipeline.processingActive = false;
    consoleError.mockRestore();
  });

  it('handles executePipeline successfully and triggers notification', async () => {
    config.input_directories = ['/mock/dir'];
    config.notifications = true;

    const { getByText } = render(Page);
    const btn = getByText('Start Processing');
    await fireEvent.click(btn);

    await waitFor(() => expect(pipeline.processingActive).toBe(true));
    await waitFor(() => expect(pipeline.processingActive).toBe(false));
    await waitFor(() => expect(getByText('Start Processing')).toBeInTheDocument());

    // Check if notification was sent
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(sendNotification).toHaveBeenCalled());
  });

  it('handles executePipeline rejection with strict error parsing', async () => {
    config.input_directories = ['/mock/error-strict'];

    const { getByText } = render(Page);
    const btn = getByText('Start Processing');
    await fireEvent.click(btn);

    await waitFor(() => {
      expect(toastState.toasts.some((t) => t.message.includes('Strict Type Error Message'))).toBe(
        true
      );
    });
  });

  it('handles keyboard shortcuts globally and pointer events', async () => {
    render(Page);

    // Simulate pointer move and up
    await fireEvent.pointerMove(window);
    await fireEvent.pointerUp(window);

    // Simulate keydowns
    await fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    await fireEvent.keyDown(window, { key: 'Escape' });

    // Keydown on input should return early
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    document.body.removeChild(input);

    // Spacebar key
    await fireEvent.keyDown(window, { key: ' ' });

    // Shift, Alt, Meta keys
    await fireEvent.keyDown(window, { key: 'b', shiftKey: true, altKey: true });
  });

  it('handles drag and drop events', async () => {
    render(Page);
    await new Promise((r) => setTimeout(r, 50));

    const dragEnter = eventHandlers['tauri://drag-enter'];
    const dragDrop = eventHandlers['tauri://drag-drop'];
    const dragLeave = eventHandlers['tauri://drag-leave'];

    expect(dragEnter).toBeDefined();

    if (dragEnter) dragEnter({ payload: { paths: ['/mock/drag'] } });
    if (dragDrop) dragDrop({ payload: { paths: ['/mock/drop'] } });
    if (dragLeave) dragLeave({ payload: {} });
  });

  it('handles UI interactions and commands', async () => {
    const { getByRole, getByText } = render(Page);
    // Command palette button (navbar)
    const cmdPaletteBtn = getByRole('button', { name: /Open command palette/i });
    await fireEvent.click(cmdPaletteBtn);

    // About application button (navbar)
    const aboutBtn = getByRole('button', { name: /About Application/i });
    await fireEvent.click(aboutBtn);

    // About modal close button
    const closeAboutBtn = getByText('Close');
    await fireEvent.click(closeAboutBtn);

    // Trigger start-pipeline and stop-pipeline commands via action
    const allCmds = filterCommands('');
    const startCmd = allCmds.find((c) => c.id === 'start-pipeline');
    if (startCmd && startCmd.action) startCmd.action();

    const stopCmd = allCmds.find((c) => c.id === 'stop-pipeline');
    if (stopCmd && stopCmd.action) stopCmd.action();

    // Trigger pipeline progress with a matching subdir
    pipeline.directoryStatuses['/mock/dir'] = 'pending';
    config.input_directories = ['/mock/dir'];

    const progressHandler = eventHandlers['pipeline-progress'];
    if (progressHandler) {
      progressHandler({
        payload: {
          directory: '/mock/dir/subdir',
          completed_files: 1,
          total_files: 10,
          current_file: 'test.mkv'
        }
      });
    }
  });
  it('handles initialization errors', async () => {
    // Clear global state leaked from previous tests while preserving mock IPC
    if (window.__TAURI_INTERNALS__) {
      delete window.__TAURI_INTERNALS__.metadata;
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    // @ts-expect-error mocking tauri
    getCurrentWindow.mockImplementation(() => {
      throw new Error('Test Init Error');
    });

    render(Page);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to initialize page:', expect.any(Error));
    });

    consoleError.mockRestore();

    // Restore the mock to prevent leaking to other tests
    // @ts-expect-error mocking
    getCurrentWindow.mockImplementation(() => ({
      onCloseRequested: vi.fn((cb) => {
        windowHandlers.onCloseRequested = cb;
        return Promise.resolve(vi.fn());
      }),
      listen: vi.fn(() => Promise.resolve(vi.fn())),
      setProgressBar: windowHandlers.setProgressBar,
      destroy: vi.fn()
    }));
  });

  it('handles missing directories on startup', async () => {
    configState.isLoaded = true;
    config.input_directories = ['/mock/missing'];
    render(Page);
    await waitFor(() => {
      expect(config.input_directories.length).toBe(0);
      expect(toastState.toasts.some((t) => t.message.includes('Removed 1 stale'))).toBe(true);
    });
  });

  it('handles GET_ENCODER_CAPABILITIES failure', async () => {
    mockIPC((cmd) => {
      if (cmd === TAURI_COMMANDS.GET_ENCODER_CAPABILITIES) throw new Error('API failure');
      return null;
    });
    render(Page);
    await new Promise((r) => setTimeout(r, 100));
  });

  it('handles directory statues during process progress', async () => {
    render(Page);
    await new Promise((r) => setTimeout(r, 50));
    pipeline.directoryStats['/mock/dir'] = {
      file_count: 1,
      exists: true,
      total_size_bytes: 0,
      files: [],
      history_skipped_bytes: 0,
      history_skipped_count: 0
    };
    pipeline.directoryStatuses['/mock/dir'] = 'pending';
    config.input_directories = ['/mock/dir'];

    // 261: active_directory makes it processing
    if (eventHandlers['process-progress']) {
      eventHandlers['process-progress']({
        payload: { active_directory: '/mock/dir/subdir' }
      });
    }
    expect(pipeline.directoryStatuses['/mock/dir']).toBe('processing');

    // 243: file_completed makes it done
    if (eventHandlers['process-progress']) {
      eventHandlers['process-progress']({
        payload: { file_completed: 'file1.mkv', root_directory: '/mock/dir' }
      });
    }
    expect(pipeline.directoryStatuses['/mock/dir']).toBe('done');
  });

  it('handles GET_DIRECTORY_STATS throwing during executePipeline', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    config.input_directories = ['/mock/error'];
    const { getByText } = render(Page);
    await fireEvent.click(getByText('Start Processing'));
    await waitFor(() => expect(pipeline.processingActive).toBe(false));
    consoleError.mockRestore();
  });

  it('handles empty directory making it skipped during executePipeline', async () => {
    config.input_directories = ['/mock/empty'];
    const { getByText } = render(Page);
    await fireEvent.click(getByText('Start Processing'));
    await waitFor(() => {
      expect(pipeline.directoryStatuses['/mock/empty']).toBe('skipped');
    });
  });

  it('handles notification throwing during executePipeline', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 457
    const { requestPermission } = await import('@tauri-apps/plugin-notification');
    // @ts-expect-error mocking
    requestPermission.mockRejectedValueOnce(new Error('Permission error'));

    config.input_directories = ['/mock/dir'];
    config.notifications = true;
    const { getByText } = render(Page);
    await fireEvent.click(getByText('Start Processing'));
    await waitFor(() => expect(pipeline.processingActive).toBe(false));
    consoleWarn.mockRestore();
  });

  it('handles directory cleanup to done in finally block', async () => {
    config.input_directories = ['/mock/dir'];
    const { getByText } = render(Page);

    // Trick the finally block into thinking we have remaining processing statuses
    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 10;

    await fireEvent.click(getByText('Start Processing'));
    await waitFor(() => expect(pipeline.processingActive).toBe(false));
  });

  it('handles abort error safely', async () => {
    config.crf = 98; // Trigger abort error
    const { getByText } = render(Page);
    pipeline.processingActive = true;
    await waitFor(() =>
      expect(getByText((content) => content.includes('Stop Execution'))).toBeInTheDocument()
    );
    await fireEvent.click(getByText((content) => content.includes('Stop Execution')));
    await waitFor(() => expect(pipeline.isAborting).toBe(false));
  });

  it('handles clear history error', async () => {
    config.crf = 99; // Trigger DB Error
    const { getByRole } = render(Page);
    await new Promise((r) => setTimeout(r, 50));

    const allCmds = filterCommands('');
    const clearCmd = allCmds.find((c) => c.id === 'clear-history');
    if (clearCmd && clearCmd.action) clearCmd.action();

    await waitFor(() =>
      expect(getByRole('button', { name: /Clear History/i })).toBeInTheDocument()
    );
    await fireEvent.click(getByRole('button', { name: /Clear History/i }));

    await waitFor(() =>
      expect(toastState.toasts.some((t) => t.message.includes('Failed to clear history'))).toBe(
        true
      )
    );
  });

  it('handles sync taskbar catch block', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 79: mock getCurrentWindow to throw sync error for taskbar effect
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    // @ts-expect-error mocking tauri
    getCurrentWindow.mockImplementationOnce(() => {
      throw new Error('Taskbar sync error');
    });

    if (!window.__TAURI_INTERNALS__) window.__TAURI_INTERNALS__ = {};
    window.__TAURI_INTERNALS__.metadata = {};

    pipeline.processingActive = true;
    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 5;

    render(Page);
    await new Promise((r) => setTimeout(r, 50));
    consoleWarn.mockRestore();
  });
});
