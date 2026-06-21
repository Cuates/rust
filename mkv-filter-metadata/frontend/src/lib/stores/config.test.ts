import TestWrapper from '../components/TestWrapper.svelte';
import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  config,
  resetConfigToDefaults,
  isConfigDefault,
  loadConfig,
  configState,
  appState
} from './config.svelte';
import { load } from '@tauri-apps/plugin-store';
import {} from 'svelte';

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn()
}));

describe('config.svelte', () => {
  beforeEach(() => {
    resetConfigToDefaults();
    configState.isLoaded = false;
    vi.clearAllMocks();
  });

  it('should have correct default state', () => {
    expect(config.conversion_mode).toBe('remux');
    expect(config.video_codec).toBe('libx265');
    expect(config.preset).toBe('faster');
    expect(config.crf).toBe(18);
    expect(config.recursive).toBe(false);
    expect(config.save_queue_list).toBe(false);
    expect(config.input_directories).toEqual([]);
    expect(config.notifications).toBe(true);
    expect(isConfigDefault()).toBe(true);
  });

  it('resetConfigToDefaults should reset config', () => {
    config.crf = 25;
    config.conversion_mode = 'reencode';
    config.notifications = false;
    expect(isConfigDefault()).toBe(false);

    resetConfigToDefaults();

    expect(config.crf).toBe(18);
    expect(config.conversion_mode).toBe('remux');
    expect(config.notifications).toBe(true);
    expect(isConfigDefault()).toBe(true);
  });

  it('loadConfig should load from store and override defaults', async () => {
    const mockStore = {
      get: vi.fn((key: string) => {
        if (key === 'crf') return Promise.resolve(22);
        if (key === 'remux_concurrency') return Promise.resolve(10); // Should be capped at 8
        return Promise.resolve(null);
      }),
      set: vi.fn(),
      save: vi.fn()
    };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );

    await loadConfig();

    expect(load).toHaveBeenCalledWith('config.json', { autoSave: false, defaults: {} });
    expect(mockStore.get).toHaveBeenCalledWith('crf');
    expect(config.crf).toBe(22);
    // test bounds clamping
    expect(config.remux_concurrency).toBe(8);
    // test save_queue_list clearing
    expect(config.input_directories).toEqual([]);
    expect(configState.isLoaded).toBe(true);
  });

  it('appState should have initial structure', () => {
    expect(appState.osTheme).toBe('dark');
    expect(appState.hardwareEncoders.nvenc).toBe(false);
    expect(appState.ffmpegVersion).toBe('');
  });

  it('initConfigWatcher should save config on changes', async () => {
    vi.useFakeTimers();
    const mockStore = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );
    await loadConfig();

    render(TestWrapper);

    config.crf = 20;

    await vi.runAllTimersAsync();

    expect(mockStore.set).toHaveBeenCalled();
    // Verify input_directories wasn't saved because save_queue_list was false
    expect(mockStore.set).toHaveBeenCalledWith('input_directories', []);
    expect(mockStore.save).toHaveBeenCalled();

    // Now turn it on and test it saves correctly
    config.save_queue_list = true;
    config.input_directories = ['/some/path'];
    await vi.runAllTimersAsync();
    expect(mockStore.set).toHaveBeenCalledWith('input_directories', ['/some/path']);

    vi.useRealTimers();
  });
});
