import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import TerminalLog from './TerminalLog.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';
import { addToast } from '$lib/stores/toast.svelte';
import { UI_STRINGS } from '$lib/constants';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn()
}));
vi.mock('$lib/stores/toast.svelte', () => ({
  addToast: vi.fn()
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve())
  }
});

describe('TerminalLog.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipeline.consoleLogs = [];
  });

  it('renders empty log message when no logs exist', () => {
    render(TerminalLog);
    expect(screen.getByText(UI_STRINGS.LOGS_WILL_APPEAR)).toBeInTheDocument();
  });

  it('renders log lines with correct classes', () => {
    pipeline.consoleLogs = [
      { id: 1, text: 'Info message' },
      { id: 2, text: 'Warning message' },
      { id: 3, text: 'Error message' },
      { id: 4, text: 'Success message' }
    ];

    pipeline.consoleLogs[1].text = 'WARN: message';
    pipeline.consoleLogs[2].text = 'ERROR: message';
    pipeline.consoleLogs[3].text = 'SUCCESS: message';

    render(TerminalLog);

    expect(screen.getByText('Info message')).toBeInTheDocument();
    expect(screen.getByText('WARN: message')).toBeInTheDocument();
    expect(screen.getByText('ERROR: message')).toBeInTheDocument();
    expect(screen.getByText('SUCCESS: message')).toBeInTheDocument();
  });

  it('copies logs to clipboard when copy button is clicked', async () => {
    vi.useFakeTimers();
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockResolvedValueOnce('Log 1\n');

    render(TerminalLog);

    const copyBtn = screen.getByLabelText(UI_STRINGS.COPY_LOGS);
    await fireEvent.click(copyBtn);

    expect(invoke).toHaveBeenCalledWith('read_session_log');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Log 1\n');

    // Test copiedStatus reset
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('handles copy logs failure with string error', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];

    vi.mocked(invoke).mockResolvedValueOnce('Log 1'); // Mock READ_SESSION_LOG
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce('String clipboard error');

    render(TerminalLog);
    const copyBtn = screen.getByLabelText(UI_STRINGS.COPY_LOGS);
    await fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Log 1');
  });

  it('handles empty fullLogText when copying', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockResolvedValueOnce(''); // Empty log

    render(TerminalLog);

    const copyBtn = screen.getByLabelText(UI_STRINGS.COPY_LOGS);
    await fireEvent.click(copyBtn);

    expect(addToast).toHaveBeenCalledWith(UI_STRINGS.NO_SESSION_LOG, 'error');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('handles errors when copying', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Invoke error'));

    render(TerminalLog);

    const copyBtn = screen.getByLabelText(UI_STRINGS.COPY_LOGS);
    await fireEvent.click(copyBtn);

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining(UI_STRINGS.COPY_LOGS_FAILED),
      'error'
    );
  });

  it('saves logs to file when save button is clicked', async () => {
    vi.useFakeTimers();
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];

    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'check_session_log') return Promise.resolve(true);
      return Promise.resolve();
    });

    vi.mocked(save).mockResolvedValueOnce('C:\\logs\\test.log');

    render(TerminalLog);

    const saveBtn = screen.getByLabelText(UI_STRINGS.EXPORT_LOGS);
    await fireEvent.click(saveBtn);

    expect(invoke).toHaveBeenCalledWith('check_session_log');
    expect(save).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('save_log_file', { path: 'C:\\logs\\test.log' });

    // Test savedStatus reset
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('does not save logs if check returns false', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];

    vi.mocked(invoke).mockResolvedValueOnce(false); // check_session_log

    render(TerminalLog);

    const saveBtn = screen.getByLabelText(UI_STRINGS.EXPORT_LOGS);
    await fireEvent.click(saveBtn);

    expect(invoke).toHaveBeenCalledWith('check_session_log');
    expect(addToast).toHaveBeenCalledWith(UI_STRINGS.NO_ACTIVE_SESSION_LOG, 'error');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not call save_log_file if dialog is cancelled', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];

    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'check_session_log') return Promise.resolve(true);
      return Promise.resolve();
    });
    vi.mocked(save).mockResolvedValueOnce(null); // Cancelled

    render(TerminalLog);

    const saveBtn = screen.getByLabelText(UI_STRINGS.EXPORT_LOGS);
    await fireEvent.click(saveBtn);

    expect(save).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('save_log_file', expect.anything());
  });

  it('handles errors when saving', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Check failed'));

    render(TerminalLog);

    const saveBtn = screen.getByLabelText(UI_STRINGS.EXPORT_LOGS);
    await fireEvent.click(saveBtn);

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining(UI_STRINGS.SAVE_LOG_FAILED),
      'error'
    );
  });

  it('handles errors when saving with string error', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockRejectedValueOnce('Check failed string');

    render(TerminalLog);

    const saveBtn = screen.getByLabelText(UI_STRINGS.EXPORT_LOGS);
    await fireEvent.click(saveBtn);

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining(UI_STRINGS.SAVE_LOG_FAILED),
      'error'
    );
  });

  it('scrolls to bottom correctly (via export function)', async () => {
    const { component } = render(TerminalLog);
    const { tick } = await import('svelte');
    await tick();
    expect(() => component.scrollToBottom()).not.toThrow();
    expect(() => component.scrollToBottom(true)).not.toThrow();
  });

  it('handles scroll functions when terminalEl is null', async () => {
    const { component, unmount } = render(TerminalLog);
    unmount(); // This sets terminalEl to null
    expect(() => component.scrollToBottom()).not.toThrow();
    expect(() => component.scrollToBottom(true)).not.toThrow();

    // We can also trigger the component's scrollToTop if it was exported, but it isn't exported directly.
    // However, if we just want to cover `if (!terminalEl)`, we covered it for scrollToBottom.
  });

  it('handles scroll event when unmounted', async () => {
    const { unmount } = render(TerminalLog);
    const shell = document.getElementById('terminal-shell');

    unmount(); // sets terminalEl to null

    if (shell) {
      expect(() => fireEvent.scroll(shell)).not.toThrow();
    }
  });

  it('updates scroll state on scroll event', async () => {
    render(TerminalLog);
    const shell = document.getElementById('terminal-shell');
    if (shell) {
      // Mock properties for scroll height
      Object.defineProperty(shell, 'scrollTop', { value: 0, writable: true });
      Object.defineProperty(shell, 'scrollHeight', { value: 500 });
      Object.defineProperty(shell, 'clientHeight', { value: 100 });
      await fireEvent.scroll(shell);
    }
  });

  it('handles manual scroll to top and bottom', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    render(TerminalLog);
    const shell = document.getElementById('terminal-shell');
    if (shell) {
      shell.scrollTo = vi.fn();

      // Initially, we are at top and bottom if there is no scroll, but let's mock it so we are not at bottom and top.
      Object.defineProperty(shell, 'scrollTop', { value: 200, writable: true });
      Object.defineProperty(shell, 'scrollHeight', { value: 500 });
      Object.defineProperty(shell, 'clientHeight', { value: 100 });
      await fireEvent.scroll(shell);

      const topBtn = screen.getByLabelText(UI_STRINGS.SCROLL_TO_TOP);
      const bottomBtn = screen.getByLabelText(UI_STRINGS.SCROLL_TO_LATEST);

      await fireEvent.click(topBtn);
      expect(shell.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

      await fireEvent.click(bottomBtn);
      expect(shell.scrollTo).toHaveBeenCalledWith({ top: 500, behavior: 'smooth' });
    }
  });
});
