import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  config,
  configState,
  loadConfig,
  initConfigWatcher,
  resetConfigToDefaults,
  isConfigDefault
} from './config.svelte';
import { flushSync } from 'svelte';

vi.mock('@tauri-apps/plugin-store', () => {
  const store = {
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn()
  };
  return {
    load: vi.fn().mockResolvedValue(store)
  };
});

describe('Config Store', () => {
  beforeEach(() => {
    resetConfigToDefaults();
    configState.isLoaded = false;
    vi.clearAllMocks();
  });

  it('resets to defaults correctly', () => {
    config.theme = 'light';
    expect(isConfigDefault()).toBe(false);
    resetConfigToDefaults();
    expect(config.theme).toBe('system');
    expect(isConfigDefault()).toBe(true);
  });

  it('loads config from store properly', async () => {
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load('config.json', { autoSave: false, defaults: {} });

    // Mock get to return specific values
    vi.mocked(store.get).mockImplementation(async (key: string) => {
      if (key === 'theme') return 'light';
      if (key === 'concurrency') return 10;
      if (key === 'save_queue_list') return false; // To trigger branch condition
      return undefined;
    });

    // simulate loaded queue
    config.input_directories = ['/some/dir'];

    await loadConfig();

    expect(configState.isLoaded).toBe(true);
    expect(config.theme).toBe('light');
    expect(config.concurrency).toBe(10);
    // Should clear queue since save_queue_list is false
    expect(config.input_directories.length).toBe(0);
  });

  it('initializes config watcher and saves on change', async () => {
    vi.useFakeTimers();
    const { load } = await import('@tauri-apps/plugin-store');
    const store = await load('config.json', { autoSave: false, defaults: {} });

    // Call loadConfig to populate the private configStore variable
    await loadConfig();

    // This creates an effect root context manually if needed
    initConfigWatcher();

    // Trigger reactivity
    config.theme = 'light';

    try {
      flushSync();
    } catch {
      // ignore
    }

    // Wait for the debounce timeout and let async operations settle
    await vi.advanceTimersByTimeAsync(600);

    // Check if store.set and store.save were called
    // Vitest runs effects automatically, let's see if it works.
    expect(store.set).toHaveBeenCalled();
    expect(store.save).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
