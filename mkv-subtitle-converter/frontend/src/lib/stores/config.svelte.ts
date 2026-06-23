import { load, type Store } from '@tauri-apps/plugin-store';
import type { AppConfig } from '$lib/types';
import { DEFAULT_CONFIG } from '$lib/types';

// Global config state (reactive via Svelte 5 runes)
export const config = $state<AppConfig>({ ...DEFAULT_CONFIG });

export function resetConfigToDefaults(): void {
  Object.assign(config, DEFAULT_CONFIG);
}

export function isConfigDefault(): boolean {
  return JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG);
}

// Store instance
let configStore: Store | null = null;
export const configState = $state({ isLoaded: false });

export async function loadConfig(): Promise<void> {
  configStore = await load('config.json', { autoSave: false, defaults: {} });

  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const val = await configStore!.get<unknown>(key);
    if (val !== null && val !== undefined) {
      if (key === 'shortcuts' && typeof val === 'object') {
        config.shortcuts = { ...DEFAULT_CONFIG.shortcuts, ...(val as Record<string, string>) };
      } else {
        (config as unknown as Record<string, unknown>)[key] = val;
      }
    }
  }

  // If user opted out of saving queue, clear it on load.
  if (!config.save_queue_list) {
    config.input_directories = [];
  }

  configState.isLoaded = true;
}

export function initConfigWatcher(): void {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect.root(() => {
    $effect(() => {
      if (!configState.isLoaded || !configStore) return;

      // Access all tracked properties so Svelte picks up changes.
      const current = {
        input_directories: config.save_queue_list ? config.input_directories : [],
        recursive: config.recursive,
        save_queue_list: config.save_queue_list,
        notifications: config.notifications,
        concurrency: config.concurrency,
        shortcuts: $state.snapshot(config.shortcuts),
        theme: config.theme
      };

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        for (const [key, value] of Object.entries(current)) {
          await configStore!.set(key, value);
        }
        await configStore!.save();
      }, 500);
    });
  });
}

// Global app/UI state
export const appState = $state({
  ffmpegVersion: '',
  ffprobeVersion: '',
  appVersion: __APP_VERSION__
});
