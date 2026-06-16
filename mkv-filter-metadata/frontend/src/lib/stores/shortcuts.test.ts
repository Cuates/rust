import TestWrapper from '../components/TestWrapper.svelte';
import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shortcuts, resetShortcutsToDefaults, loadShortcuts } from './shortcuts.svelte';

import { load } from '@tauri-apps/plugin-store';
import {} from 'svelte';

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn()
}));

describe('shortcuts.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetShortcutsToDefaults();
  });

  it('loadShortcuts should load from store and override defaults', async () => {
    const mockStore = {
      get: vi.fn().mockImplementation(async (key) => {
        if (key === 'startPipeline') return 'Shift+Space';
        return null;
      })
    };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );

    await loadShortcuts();

    expect(load).toHaveBeenCalledWith('shortcuts.json', expect.any(Object));
    expect(mockStore.get).toHaveBeenCalledWith('startPipeline');
    expect(shortcuts.startPipeline).toBe('Shift+Space');
    expect(shortcuts.abortPipeline).toBe('Escape'); // not overridden

    // Cleanup state leak for next tests
    shortcuts.startPipeline = 'Enter';
  });

  it('initShortcutWatcher should save shortcuts on changes', async () => {
    vi.useFakeTimers();
    const mockStore = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );
    await loadShortcuts();

    render(TestWrapper);

    shortcuts.startPipeline = 'Ctrl+R';

    await vi.runAllTimersAsync();

    expect(mockStore.set).toHaveBeenCalled();
    expect(mockStore.save).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
