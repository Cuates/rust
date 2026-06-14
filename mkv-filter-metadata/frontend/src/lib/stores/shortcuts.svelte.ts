import { load, type Store } from '@tauri-apps/plugin-store';

export interface ShortcutConfig {
  startPipeline: string;
  abortPipeline: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  startPipeline: 'Shift+Enter',
  abortPipeline: 'Escape'
};

export const shortcuts = $state<ShortcutConfig>({ ...DEFAULT_SHORTCUTS });

let shortcutsStore: Store | null = null;
const shortcutsState = $state({ isLoaded: false });

export function resetShortcutsToDefaults() {
  Object.assign(shortcuts, DEFAULT_SHORTCUTS);
}

export function isShortcutsDefault() {
  return JSON.stringify(shortcuts) === JSON.stringify(DEFAULT_SHORTCUTS);
}

export async function loadShortcuts() {
  shortcutsStore = await load('shortcuts.json', { autoSave: false, defaults: {} });

  for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
    const val = await shortcutsStore!.get<unknown>(key);
    if (val !== null && val !== undefined) {
      (shortcuts as unknown as Record<string, unknown>)[key] = val;
    }
  }
  shortcutsState.isLoaded = true;
}

/* v8 ignore next 15 */
export function initShortcutWatcher() {
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (!shortcutsState.isLoaded || !shortcutsStore) return;

    const currentShortcuts = {
      startPipeline: shortcuts.startPipeline,
      abortPipeline: shortcuts.abortPipeline
    };

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      for (const [key, value] of Object.entries(currentShortcuts)) {
        await shortcutsStore!.set(key, value);
      }
      await shortcutsStore!.save();
    }, 500);
  });
}
