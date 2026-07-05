import TestWrapper from '../components/TestWrapper.svelte';
import { render } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  config,
  resetConfigToDefaults,
  isConfigDefault,
  loadConfig,
  configState,
  appState,
  getResolvedTheme,
  savedPresets,
  saveCurrentAsPreset,
  applyPreset,
  deletePreset,
  loadPresets,
  initPresetsWatcher
} from './config.svelte';
import { load, type Store } from '@tauri-apps/plugin-store';
import { tick } from 'svelte';

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn()
}));

describe('config.svelte', () => {
  beforeEach(() => {
    resetConfigToDefaults();
    configState.isLoaded = false;
    savedPresets.splice(0, savedPresets.length);
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
        if (key === 'remux_concurrency') return Promise.resolve(10); // Should be capped at 2
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
    expect(config.remux_concurrency).toBe(2);
    // test save_queue_list clearing
    expect(config.input_directories).toEqual([]);
    expect(configState.isLoaded).toBe(true);
  });

  it('loadConfig should clamp remux_concurrency to 1 for hdd storage', async () => {
    const mockStore = {
      get: vi.fn((key: string) => {
        if (key === 'storage_type') return Promise.resolve('hdd');
        if (key === 'remux_concurrency') return Promise.resolve(2);
        return Promise.resolve(null);
      }),
      set: vi.fn(),
      save: vi.fn()
    };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );

    await loadConfig();
    expect(config.remux_concurrency).toBe(1);
  });

  it('loadConfig should retain input_directories if save_queue_list is true', async () => {
    config.save_queue_list = true;
    config.input_directories = ['/keep/this'];
    const mockStore = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as import('@tauri-apps/plugin-store').Store
    );

    await loadConfig();
    expect(config.input_directories).toEqual(['/keep/this']);
  });

  it('getResolvedTheme should return osTheme when theme is system, else return theme', () => {
    const originalOsTheme = appState.osTheme;
    appState.osTheme = 'light';

    config.theme = 'system';
    expect(getResolvedTheme()).toBe('light');

    config.theme = 'dark';
    expect(getResolvedTheme()).toBe('dark');

    appState.osTheme = originalOsTheme;
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

  describe('Presets', () => {
    it('loadPresets loads stored presets from disk', async () => {
      const mockStore = {
        get: vi.fn().mockResolvedValue([{ name: 'Disk Preset', config: { crf: 40 } }]),
        set: vi.fn(),
        save: vi.fn()
      };
      vi.mocked(load).mockResolvedValue(mockStore as unknown as Store);

      await loadPresets();
      expect(savedPresets.length).toBe(1);
      expect(savedPresets[0].name).toBe('Disk Preset');
    });

    it('saves current config as a preset without personal settings', () => {
      // Mock preset store dependencies
      config.video_codec = 'libx265';
      config.crf = 25;
      config.theme = 'dark';
      config.input_directories = ['/some/path'];

      saveCurrentAsPreset('My Custom Preset');

      expect(savedPresets.length).toBe(1);
      const saved = savedPresets[0];
      expect(saved.name).toBe('My Custom Preset');
      expect(saved.config.video_codec).toBe('libx265');
      expect(saved.config.crf).toBe(25);

      // Personal settings should be excluded
      expect((saved.config as unknown as Record<string, unknown>).theme).toBeUndefined();
      expect(
        (saved.config as unknown as Record<string, unknown>).input_directories
      ).toBeUndefined();
    });

    it('overwrites an existing preset if the name matches', () => {
      config.crf = 10;
      saveCurrentAsPreset('Duplicate');

      config.crf = 30;
      saveCurrentAsPreset('Duplicate'); // Should overwrite

      const filtered = savedPresets.filter((p) => p.name === 'Duplicate');
      expect(filtered.length).toBe(1);
      expect(filtered[0].config.crf).toBe(30);
    });

    it('applies a preset to the current config', () => {
      // Setup a preset
      config.crf = 15;
      saveCurrentAsPreset('ApplyMe');

      // Change current config
      config.crf = 50;

      // Apply
      const preset = savedPresets.find((p) => p.name === 'ApplyMe')!;
      applyPreset(preset);

      expect(config.crf).toBe(15);
    });

    it('deletes a preset by name', () => {
      saveCurrentAsPreset('ToDelete');
      const startCount = savedPresets.length;

      deletePreset('ToDelete');
      expect(savedPresets.length).toBe(startCount - 1);
      expect(savedPresets.find((p) => p.name === 'ToDelete')).toBeUndefined();
    });
  });

  describe('Presets Persistence', () => {
    it('loads and saves presets', async () => {
      const mockStore = {
        get: vi.fn().mockResolvedValue([{ name: 'Test Preset', config: {} }]),
        set: vi.fn(),
        save: vi.fn()
      };
      vi.mocked(load).mockResolvedValue(mockStore as unknown as Store);

      await loadPresets();

      // Verify it loaded the preset
      expect(savedPresets.length).toBe(1);
      expect(savedPresets[0].name).toBe('Test Preset');

      // Trigger the watcher by changing length inside a component
      render(TestWrapper, {
        props: {
          children: () => {
            initPresetsWatcher();
            savedPresets.push({
              name: 'PersistTest',
              config: { ...config }
            });
          }
        }
      });

      // Wait for svelte reactive effects to trigger and promises to resolve
      await tick();
      await new Promise((r) => setTimeout(r, 10));
      expect(mockStore.set).toHaveBeenCalled();
      expect(mockStore.save).toHaveBeenCalled();
    });
    it('ignores empty name when saving preset', async () => {
      saveCurrentAsPreset('   ');
      expect(savedPresets).toHaveLength(0); // the init 'HD Default'
    });

    it('ignores deleting a non-existent preset', async () => {
      deletePreset('NonExistent');
      expect(savedPresets).toHaveLength(0);
    });
  });
});
