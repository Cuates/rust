<script lang="ts">
  import '../styles/app.scss';
  import { onMount } from 'svelte';
  import { loadConfig, initConfigWatcher, appState } from '$lib/stores/config.svelte';
  import { loadShortcuts, initShortcutWatcher } from '$lib/stores/shortcuts.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  let { children } = $props();

  async function applyThemeBody() {
    try {
      const appWindow = getCurrentWindow();
      if (appState.isDarkMode) {
        document.documentElement.className = 'dark-mode';
        await appWindow.setTheme('dark');
      } else {
        document.documentElement.className = 'light-mode';
        await appWindow.setTheme('light');
      }
    } catch (e) {
      console.error(e);
    }
  }

  onMount(() => {
    try {
      getCurrentWindow().show();
    } catch (e) {
      console.error(e);
    }

    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      appState.isDarkMode = savedTheme === 'dark';
    } else {
      appState.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Do not await this, let it load in the background so the UI renders instantly
    Promise.all([loadConfig(), loadShortcuts()]).catch((e) => {
      console.error('Failed to load Tauri stores (are plugins registered?):', e);
    });
  });

  $effect(() => {
    // This will run whenever appState.isDarkMode changes
    applyThemeBody();
  });

  initConfigWatcher();
  initShortcutWatcher();
</script>

{@render children()}

<ToastContainer />
