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
    config,
    loadPresets,
    initPresetsWatcher
  } from '$lib/stores/config.svelte';
  import { loadShortcuts, initShortcutWatcher } from '$lib/stores/shortcuts.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import { addToast } from '$lib/stores/toast.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import { paletteState, registerCommand } from '$lib/stores/commands.svelte';

  let { children } = $props();

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      paletteState.isOpen = !paletteState.isOpen;
    }
  }

  async function applyThemeWindow(theme: 'light' | 'dark', isSystem: boolean) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).__TAURI_INTERNALS__?.metadata) return; // Prevent crash if Tauri is not fully initialized
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
    window.onerror = function (msg, url, lineNo, columnNo, error) {
      console.error('GLOBAL ERROR:', msg, error);
      document.body.innerHTML += `<div style="position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:10px;">ERROR: ${msg} ${error?.stack}</div>`;
      return false;
    };
    window.addEventListener('unhandledrejection', function (event) {
      document.body.innerHTML += `<div style="position:fixed;top:0;left:0;z-index:9999;background:red;color:white;padding:10px;">PROMISE ERROR: ${event.reason}</div>`;
    });

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
    Promise.all([loadConfig(), loadShortcuts(), loadPresets()]).catch((e) => {
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
  initPresetsWatcher();

  $effect(() => {
    registerCommand({
      id: 'go-home',
      label: 'Go to Dashboard',
      enabled: () => window.location.pathname !== '/',
      action: () => window.location.assign('/')
    });
    registerCommand({
      id: 'go-settings',
      label: 'Go to Settings',
      enabled: () => window.location.pathname !== '/settings',
      action: () => window.location.assign('/settings')
    });
    registerCommand({
      id: 'go-guide',
      label: 'Go to Guide',
      enabled: () => window.location.pathname !== '/guide',
      action: () => window.location.assign('/guide')
    });
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{@render children()}

<ToastContainer />
{#if paletteState.isOpen}
  <CommandPalette />
{/if}
