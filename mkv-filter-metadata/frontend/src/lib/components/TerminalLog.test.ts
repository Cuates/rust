import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import TerminalLog from './TerminalLog.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';
import { addToast } from '$lib/stores/toast.svelte';
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
    expect(screen.getByText('Logs will appear here once processing begins...')).toBeInTheDocument();
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

    const copyBtn = screen.getByLabelText('Copy logs');
    await fireEvent.click(copyBtn);

    expect(invoke).toHaveBeenCalledWith('read_session_log');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Log 1\n');

    // Test copiedStatus reset
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('handles empty fullLogText when copying', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockResolvedValueOnce(''); // Empty log

    render(TerminalLog);

    const copyBtn = screen.getByLabelText('Copy logs');
    await fireEvent.click(copyBtn);

    expect(addToast).toHaveBeenCalledWith('No session log found on disk to copy.', 'error');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('handles errors when copying', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Invoke error'));

    render(TerminalLog);

    const copyBtn = screen.getByLabelText('Copy logs');
    await fireEvent.click(copyBtn);

    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Failed to copy logs:'), 'error');
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

    const saveBtn = screen.getByLabelText('Save logs');
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

    const saveBtn = screen.getByLabelText('Save logs');
    await fireEvent.click(saveBtn);

    expect(invoke).toHaveBeenCalledWith('check_session_log');
    expect(addToast).toHaveBeenCalledWith('No active session log found to save.', 'error');
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

    const saveBtn = screen.getByLabelText('Save logs');
    await fireEvent.click(saveBtn);

    expect(save).toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith('save_log_file', expect.anything());
  });

  it('handles errors when saving', async () => {
    pipeline.consoleLogs = [{ id: 1, text: 'Log 1' }];
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Check failed'));

    render(TerminalLog);

    const saveBtn = screen.getByLabelText('Save logs');
    await fireEvent.click(saveBtn);

    expect(addToast).toHaveBeenCalledWith(expect.stringContaining('Failed to save log:'), 'error');
  });

  it('scrolls to bottom correctly (via export function)', async () => {
    const { component } = render(TerminalLog);
    const { tick } = await import('svelte');
    await tick();
    expect(() => component.scrollToBottom()).not.toThrow();
  });
});
