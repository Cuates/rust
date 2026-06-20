import { load, type Store } from '@tauri-apps/plugin-store';

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
  notifications: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
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
  configStore = await load('config.json', { autoSave: false, defaults: {} });

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

  configState.isLoaded = true;
}

/* v8 ignore next 25 */
export function initConfigWatcher() {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (!configState.isLoaded || !configStore) return;

    // access all properties to track them
    const currentConfig = {
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
  isDarkMode: true,
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

export function toggleTheme() {
  appState.isDarkMode = !appState.isDarkMode;
  localStorage.setItem('app-theme', appState.isDarkMode ? 'dark' : 'light');
}
