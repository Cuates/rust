import { Store, load } from '@tauri-apps/plugin-store';

export type ConversionMode = 'remux' | 'reencode';

export interface AppConfig {
  input_directories: string[];
  file_extensions: string;
  recursive: boolean;
  subtitle_tracks: string;
  output_extension: string;
  conversion_mode: ConversionMode;
  video_codec: string;
  preset: string;
  crf: number;
}

const DEFAULT_CONFIG: AppConfig = {
  input_directories: [],
  file_extensions: 'mkv, mp4, mov, avi, ogm, wmv',
  recursive: false,
  subtitle_tracks: 'ang, eng, enm, zxx, und',
  output_extension: '.mkv',
  conversion_mode: 'remux',
  video_codec: 'libx265',
  preset: 'faster',
  crf: 18
};

// Global config state
export const config = $state<AppConfig>({ ...DEFAULT_CONFIG });

export function resetConfigToDefaults() {
  Object.assign(config, DEFAULT_CONFIG);
}

export function isConfigDefault() {
  return JSON.stringify(config) === JSON.stringify(DEFAULT_CONFIG);
}

// Store instance
let store: Store | null = null;
let isLoaded = $state(false);

export async function loadConfig() {
  store = await load('config.json', {
    autoSave: false
  } as unknown as import('@tauri-apps/plugin-store').StoreOptions);

  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const val = await store!.get<unknown>(key);
    if (val !== null && val !== undefined) {
      (config as unknown as Record<string, unknown>)[key] = val;
    }
  }
  isLoaded = true;
}

export function initConfigWatcher() {
  $effect(() => {
    if (!isLoaded || !store) return;

    // access all properties to track them
    const currentConfig = {
      input_directories: config.input_directories,
      file_extensions: config.file_extensions,
      recursive: config.recursive,
      subtitle_tracks: config.subtitle_tracks,
      output_extension: config.output_extension,
      conversion_mode: config.conversion_mode,
      video_codec: config.video_codec,
      preset: config.preset,
      crf: config.crf
    };

    // Using an async wrapper to save without blocking reactivity
    (async () => {
      for (const [key, value] of Object.entries(currentConfig)) {
        await store.set(key, value);
      }
      await store.save();
    })();
  });
}

export const appState = $state({
  isDarkMode: true,
  hardwareEncoders: {
    nvenc: false,
    amf: false,
    videotoolbox: false,
    qsv: false
  }
});
