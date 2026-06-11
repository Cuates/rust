import { Store, load } from '@tauri-apps/plugin-store';

export interface ShortcutConfig {
  startPipeline: string;
  abortPipeline: string;
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  startPipeline: 'Shift+Enter',
  abortPipeline: 'Escape'
};

export const shortcuts = $state<ShortcutConfig>({ ...DEFAULT_SHORTCUTS });

let store: Store | null = null;
let isLoaded = $state(false);

export function resetShortcutsToDefaults() {
  Object.assign(shortcuts, DEFAULT_SHORTCUTS);
}

export function isShortcutsDefault() {
  return JSON.stringify(shortcuts) === JSON.stringify(DEFAULT_SHORTCUTS);
}

export async function loadShortcuts() {
  store = await load('shortcuts.json', {
    autoSave: false
  } as unknown as import('@tauri-apps/plugin-store').StoreOptions);

  for (const key of Object.keys(DEFAULT_SHORTCUTS)) {
    const val = await store!.get<unknown>(key);
    if (val !== null && val !== undefined) {
      (shortcuts as unknown as Record<string, unknown>)[key] = val;
    }
  }
  isLoaded = true;
}

export function initShortcutWatcher() {
  $effect(() => {
    if (!isLoaded || !store) return;

    const currentShortcuts = {
      startPipeline: shortcuts.startPipeline,
      abortPipeline: shortcuts.abortPipeline
    };

    (async () => {
      for (const [key, value] of Object.entries(currentShortcuts)) {
        await store.set(key, value);
      }
      await store.save();
    })();
  });
}
