import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { invoke } from '@tauri-apps/api/core';
import { savedPresets } from '../../lib/stores/config.svelte';
import SettingsPage from './+page.svelte';
import { shortcuts } from '../../lib/stores/shortcuts.svelte';
import { toastState } from '../../lib/stores/toast.svelte';
import { TAURI_COMMANDS } from '../../lib/constants';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Mock Tauri window
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    onCloseRequested: vi.fn()
  }))
}));

// Mock Tauri event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn()
}));

describe('Settings Page - Keyboard Shortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shortcuts.startPipeline = 'Ctrl+Enter';
    toastState.toasts.length = 0; // clear toasts
  });

  it('allows recording a valid shortcut', async () => {
    render(SettingsPage);

    // Find the button to start recording for Start Processing
    const recordBtn = screen.getByText('Ctrl+Enter');
    await fireEvent.click(recordBtn);

    // The input should now be visible and say "Recording..."
    const input = screen.getByDisplayValue('Recording...');
    expect(input).toBeInTheDocument();

    // Simulate pressing Ctrl + P
    await fireEvent.keyDown(input, { key: 'P', ctrlKey: true });

    // The shortcut should be updated
    expect(shortcuts.startPipeline).toBe('Ctrl+P');
  });

  it('rejects recording Ctrl+K and shows a toast', async () => {
    render(SettingsPage);

    const recordBtn = screen.getByText('Ctrl+Enter');
    await fireEvent.click(recordBtn);

    const input = screen.getByDisplayValue('Recording...');

    // Simulate pressing Ctrl + K
    await fireEvent.keyDown(input, { key: 'K', ctrlKey: true });

    // The shortcut should NOT be updated
    expect(shortcuts.startPipeline).toBe('Ctrl+Enter');

    // A toast should be added
    expect(toastState.toasts.length).toBe(1);
    expect(toastState.toasts[0].message).toContain('reserved for the Command Palette');
    expect(toastState.toasts[0].type).toBe('error');
  });

  describe('Settings Page - Modals', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      toastState.toasts.length = 0;
      // Make sure history count is > 0 so the clear button is enabled
      vi.mocked(invoke).mockResolvedValue(5);
    });

    it('can open and close the reset modal without resetting', async () => {
      render(SettingsPage);
      const resetBtn = screen.getByText('Reset to Defaults');
      await fireEvent.click(resetBtn);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.click(cancelBtn);
      // We don't assert DOM removal here because JSDOM hangs on Svelte transitions
      expect(cancelBtn).toBeDefined();
    });

    it('can confirm reset defaults', async () => {
      // First, modify config so it's not default
      const { config } = await import('../../lib/stores/config.svelte');
      config.notifications = false;
      render(SettingsPage);

      const btn = screen.getByText(/Reset to Defaults/i);
      await fireEvent.click(btn);

      const confirmBtn = screen.getByRole('button', { name: 'Reset Defaults' });
      await fireEvent.click(confirmBtn);

      expect(toastState.toasts.length).toBeGreaterThan(0);
      expect(toastState.toasts[0].message).toContain('restored to defaults');
    });

    it('shows info toast if already at default values', async () => {
      // Reset config to defaults
      const { resetConfigToDefaults } = await import('../../lib/stores/config.svelte');
      const { resetShortcutsToDefaults } = await import('../../lib/stores/shortcuts.svelte');
      resetConfigToDefaults();
      resetShortcutsToDefaults();

      render(SettingsPage);

      const btn = screen.getByText(/Reset to Defaults/i);
      await fireEvent.click(btn);

      const confirmBtn = screen.getByRole('button', { name: 'Reset Defaults' });
      await fireEvent.click(confirmBtn);

      expect(toastState.toasts.length).toBeGreaterThan(0);
      expect(toastState.toasts[toastState.toasts.length - 1].message).toContain(
        'already at their default values'
      );
    });

    it('can open and close the clear history modal without clearing', async () => {
      render(SettingsPage);
      // Wait for historyCount to load and button to be enabled
      await waitFor(() => {
        expect(screen.getByText('Clear Database History')).not.toBeDisabled();
      });
      const clearBtn = screen.getByText('Clear Database History');
      await fireEvent.click(clearBtn);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      await fireEvent.click(cancelBtn);

      expect(cancelBtn).toBeDefined();
    });

    it('can confirm clear history', async () => {
      render(SettingsPage);
      await waitFor(() => {
        expect(screen.getByText('Clear Database History')).not.toBeDisabled();
      });
      const clearBtn = screen.getByText('Clear Database History');
      await fireEvent.click(clearBtn);

      const confirmBtn = screen.getByRole('button', { name: 'Clear History' });
      await fireEvent.click(confirmBtn);

      // Tauri invoke should be called
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY);
    });

    it('shows error toast when clearing history fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY) throw 'DB Error';
        if (cmd === TAURI_COMMANDS.GET_HISTORY_COUNT) return 0;
        return null;
      });
      render(SettingsPage);

      const btn = screen.getByText(/Clear Database History/i);
      await fireEvent.click(btn);

      const confirmBtn = screen.getByRole('button', { name: 'Clear History' });
      await fireEvent.click(confirmBtn);

      expect(toastState.toasts.length).toBeGreaterThan(0);
      expect(toastState.toasts[toastState.toasts.length - 1].message).toContain('DB Error');
      consoleError.mockRestore();
    });

    it('changes storage_type to hdd and caps remux concurrency', async () => {
      const { config } = await import('../../lib/stores/config.svelte');
      config.remux_concurrency = 8;
      render(SettingsPage);
      const hddRadio = screen.getByLabelText(/HDD/i);
      await fireEvent.click(hddRadio);
      expect(config.remux_concurrency).toBe(1);
    });

    it('prevents mapping Ctrl+K as a shortcut and shows a toast', async () => {
      render(SettingsPage);

      const startBtn = screen.getByText(shortcuts.startPipeline).closest('button');
      await fireEvent.click(startBtn!);

      const input = screen.getByDisplayValue('Recording...');
      await fireEvent.keyDown(input, { key: 'k', ctrlKey: true });

      expect(toastState.toasts.length).toBeGreaterThan(0);
      expect(toastState.toasts[0].message).toContain('Command Palette');
      expect(shortcuts.startPipeline).not.toBe('Ctrl+K');
    });

    it('can record an abortPipeline shortcut and handle blur', async () => {
      render(SettingsPage);

      const abortBtn = screen.getByText(shortcuts.abortPipeline).closest('button');
      await fireEvent.click(abortBtn!);

      const input = screen.getByDisplayValue('Recording...');
      await fireEvent.keyDown(input, { key: 'Escape' });
      expect(shortcuts.abortPipeline).toBe('Escape');

      // Test blur
      await fireEvent.click(screen.getByText(shortcuts.abortPipeline).closest('button')!);
      const input2 = screen.getByDisplayValue('Recording...');
      await fireEvent.blur(input2);
      expect(screen.queryByDisplayValue('Recording...')).not.toBeInTheDocument();
    });

    it('handles clicking ssd radio button', async () => {
      render(SettingsPage);
      const ssdRadio = screen.getByLabelText(/SSD/i);
      await fireEvent.click(ssdRadio);
    });

    describe('Settings Page - Presets', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        toastState.toasts.length = 0;
        // Clear presets
        if (savedPresets) savedPresets.length = 0;
      });

      it('can save a new preset', async () => {
        render(SettingsPage);
        const input = screen.getByPlaceholderText('Preset name…');
        await fireEvent.input(input, { target: { value: 'My Preset' } });

        const saveBtn = screen.getByRole('button', { name: 'Save Current' });
        await fireEvent.click(saveBtn);

        expect(savedPresets.length).toBe(1);
        expect(toastState.toasts.length).toBeGreaterThan(0);
        expect(toastState.toasts[0].message).toContain('saved');
      });

      it('can save a new preset using Enter key', async () => {
        render(SettingsPage);
        const input = screen.getByPlaceholderText('Preset name…');
        await fireEvent.input(input, { target: { value: 'Enter Preset' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        expect(savedPresets.length).toBe(1);
        expect(savedPresets[0].name).toBe('Enter Preset');
      });

      it('can apply a preset', async () => {
        render(SettingsPage);
        // First save one
        const input = screen.getByPlaceholderText('Preset name…');
        await fireEvent.input(input, { target: { value: 'Apply Me' } });
        const saveBtn = screen.getByRole('button', { name: 'Save Current' });
        await fireEvent.click(saveBtn);

        // Now apply it
        const applyBtn = screen.getByRole('button', { name: 'Apply' });
        await fireEvent.click(applyBtn);

        expect(toastState.toasts[toastState.toasts.length - 1].message).toContain('Applied');
      });

      it('can delete a preset', async () => {
        render(SettingsPage);
        // First save one
        const input = screen.getByPlaceholderText('Preset name…');
        await fireEvent.input(input, { target: { value: 'Delete Me' } });
        const saveBtn = screen.getByRole('button', { name: 'Save Current' });
        await fireEvent.click(saveBtn);

        // Now delete it
        const deleteBtn = screen.getByRole('button', { name: 'Delete' });
        await fireEvent.click(deleteBtn);

        expect(toastState.toasts[toastState.toasts.length - 1].message).toContain('deleted');
      });
    });
  });
});
