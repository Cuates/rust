<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource-variable/jetbrains-mono';
  import '../styles/app.scss';
  import { onMount } from 'svelte';
  import {
    loadConfig,
    initConfigWatcher,
    appState,
    getResolvedTheme,
    config
  } from '$lib/stores/config.svelte';
  import { loadShortcuts, initShortcutWatcher } from '$lib/stores/shortcuts.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { addToast } from '$lib/stores/toast.svelte';

  let { children } = $props();

  async function applyThemeWindow(theme: 'light' | 'dark', isSystem: boolean) {
    try {
      const appWindow = getCurrentWindow();
      if (isSystem) {
        await appWindow.setTheme(null);
      } else {
        await appWindow.setTheme(theme);
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(() => {
    try {
      getCurrentWindow()
        .show()
        .catch((e) => {
          console.error(e);
          addToast(`Failed to show window: ${e}`, 'error');
        });
    } catch (e) {
      console.error(e);
      addToast(`Failed to initialize window context: ${e}`, 'error');
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    appState.osTheme = mediaQuery.matches ? 'dark' : 'light';

    mediaQuery.addEventListener('change', (e) => {
      appState.osTheme = e.matches ? 'dark' : 'light';
    });

    // Do not await this, let it load in the background so the UI renders instantly
    Promise.all([loadConfig(), loadShortcuts()]).catch((e) => {
      console.error('Failed to load Tauri stores (are plugins registered?):', e);
      addToast(`Failed to load saved settings: ${e}. Using defaults.`, 'warning');
    });
  });

  $effect(() => {
    const themeToApply = getResolvedTheme();
    const isSystem = config.theme === 'system';

    if (themeToApply === 'dark') {
      document.documentElement.className = 'dark-mode';
    } else {
      document.documentElement.className = 'light-mode';
    }
    applyThemeWindow(themeToApply as 'light' | 'dark', isSystem);
  });

  initConfigWatcher();
  initShortcutWatcher();
</script>

{@render children()}

<ToastContainer />
