import { load, type Store } from '@tauri-apps/plugin-store';
import { STORE_FILENAMES } from '../constants';

type ConversionMode = 'remux' | 'reencode';

type VideoCodec =
  | 'libx265'
  | 'libx264'
  | 'hevc_nvenc'
  | 'h264_nvenc'
  | 'av1_nvenc'
  | 'hevc_amf'
  | 'h264_amf'
  | 'av1_amf'
  | 'hevc_qsv'
  | 'h264_qsv'
  | 'av1_qsv'
  | 'hevc_videotoolbox'
  | 'h264_videotoolbox';

type Preset =
  | 'ultrafast'
  | 'superfast'
  | 'veryfast'
  | 'faster'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'veryslow'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'p5'
  | 'p6'
  | 'p7'
  | 'speed'
  | 'balanced'
  | 'quality'
  | 'default';

export interface AppConfig {
  theme: 'system' | 'light' | 'dark';
  input_directories: string[];
  file_extensions: string;
  recursive: boolean;
  save_queue_list: boolean;
  subtitle_tracks: string;
  output_extension: string;
  conversion_mode: ConversionMode;
  video_codec: VideoCodec;
  preset: Preset;
  crf: number;
  reencode_concurrency: number;
  remux_concurrency: number;
  storage_type: 'ssd' | 'hdd';
  notifications: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'dark',
  input_directories: [],
  file_extensions: 'mkv, mp4, mov, avi, ogm, wmv',
  recursive: false,
  save_queue_list: false,
  subtitle_tracks: 'ang, eng, enm, zxx, und',
  output_extension: '.mkv',
  conversion_mode: 'remux',
  video_codec: 'libx265',
  preset: 'faster',
  crf: 18,
  reencode_concurrency: 2,
  remux_concurrency: 4,
  storage_type: 'ssd',
  notifications: true
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
let configStore: Store | null = null;
export const configState = $state({ isLoaded: false });

export async function loadConfig() {
  configStore = await load(STORE_FILENAMES.CONFIG, { autoSave: false, defaults: {} });

  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const val = await configStore!.get<unknown>(key);
    if (val !== null && val !== undefined) {
      (config as unknown as Record<string, unknown>)[key] = val;
    }
  }

  if (!config.save_queue_list) {
    config.input_directories = [];
  }

  if (config.remux_concurrency > 8) {
    config.remux_concurrency = 8;
  }

  if (config.storage_type === 'hdd') {
    config.remux_concurrency = 1;
  }

  configState.isLoaded = true;
}

/* v8 ignore next 25 */
export function initConfigWatcher() {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (!configState.isLoaded || !configStore) return;

    // access all properties to track them
    const currentConfig = {
      theme: config.theme,
      input_directories: config.save_queue_list ? config.input_directories : [],
      file_extensions: config.file_extensions,
      recursive: config.recursive,
      save_queue_list: config.save_queue_list,
      subtitle_tracks: config.subtitle_tracks,
      output_extension: config.output_extension,
      conversion_mode: config.conversion_mode,
      video_codec: config.video_codec,
      preset: config.preset,
      crf: config.crf,
      reencode_concurrency: config.reencode_concurrency,
      remux_concurrency: config.remux_concurrency,
      storage_type: config.storage_type,
      notifications: config.notifications
    };

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      for (const [key, value] of Object.entries(currentConfig)) {
        await configStore!.set(key, value);
      }
      await configStore!.save();
    }, 500);
  });
}

export const appState = $state({
  osTheme: 'dark' as 'light' | 'dark',
  hardwareEncoders: {
    nvenc: false,
    amf: false,
    videotoolbox: false,
    qsv: false
  },
  ffmpegVersion: '',
  ffprobeVersion: '',
  mkvmergeVersion: ''
});

export function getResolvedTheme() {
  return config.theme === 'system' ? appState.osTheme : config.theme;
}

// ─── Named Config Presets ─────────────────────────────────────────────────────
// Persisted in a separate `presets.json` store so personal settings (theme,
// directories, notifications) and workflow presets remain fully decoupled.
// Excluded fields: theme, input_directories, save_queue_list, notifications.

interface WorkflowConfig {
  file_extensions: string;
  recursive: boolean;
  subtitle_tracks: string;
  output_extension: string;
  conversion_mode: ConversionMode;
  video_codec: VideoCodec;
  preset: Preset;
  crf: number;
  reencode_concurrency: number;
  remux_concurrency: number;
  storage_type: 'ssd' | 'hdd';
}

export interface NamedPreset {
  name: string;
  config: WorkflowConfig;
}

export const savedPresets = $state<NamedPreset[]>([]);

let presetsStore: Store | null = null;

/* v8 ignore start */
export async function loadPresets(): Promise<void> {
  presetsStore = await load(STORE_FILENAMES.PRESETS, { autoSave: false, defaults: {} });
  const stored = await presetsStore.get<NamedPreset[]>('presets');
  if (Array.isArray(stored)) {
    savedPresets.splice(0, savedPresets.length, ...stored);
  }
}

async function persistPresets(): Promise<void> {
  if (!presetsStore) return;
  await presetsStore.set('presets', savedPresets.slice());
  await presetsStore.save();
}
/* v8 ignore stop */

/* v8 ignore next 7 */
export function initPresetsWatcher(): void {
  $effect(() => {
    void savedPresets.length; // track length changes
    if (!presetsStore) return; // guard: don't write before the store is loaded
    persistPresets().catch(console.error);
  });
}

export function saveCurrentAsPreset(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const workflowSnapshot: WorkflowConfig = {
    file_extensions: config.file_extensions,
    recursive: config.recursive,
    subtitle_tracks: config.subtitle_tracks,
    output_extension: config.output_extension,
    conversion_mode: config.conversion_mode,
    video_codec: config.video_codec,
    preset: config.preset,
    crf: config.crf,
    reencode_concurrency: config.reencode_concurrency,
    remux_concurrency: config.remux_concurrency,
    storage_type: config.storage_type
  };

  const existing = savedPresets.findIndex((p) => p.name === trimmed);
  if (existing >= 0) {
    savedPresets[existing] = { name: trimmed, config: workflowSnapshot };
  } else {
    savedPresets.push({ name: trimmed, config: workflowSnapshot });
  }
}

export function applyPreset(preset: NamedPreset): void {
  Object.assign(config, preset.config);
}

export function deletePreset(name: string): void {
  const index = savedPresets.findIndex((p) => p.name === name);
  if (index >= 0) {
    savedPresets.splice(index, 1);
  }
}
