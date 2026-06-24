<script lang="ts">
  import '@fontsource/inter/300.css';
  import '@fontsource/inter/400.css';
  import '@fontsource/inter/500.css';
  import '@fontsource/inter/600.css';
  import '@fontsource/inter/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/500.css';
  import '../styles/app.scss';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { handleKeydown } from '$lib/stores/shortcuts.svelte';
  import { appState, config, loadConfig, initConfigWatcher } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { appendLog } from '$lib/stores/pipeline.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import {
    CMD_INIT_SESSION_LOG,
    CMD_GET_SIDECAR_VERSION,
    EVENT_PROCESS_LOG,
    EVENT_DB_INIT_FAILED
  } from '$lib/constants';

  let { children } = $props();

  async function syncNativeTitleBar(configTheme: string) {
    try {
      const appWindow = getCurrentWindow();
      if (configTheme === 'system') {
        await appWindow.setTheme(null);
      } else {
        await appWindow.setTheme(configTheme === 'dark' ? 'dark' : 'light');
      }
    } catch {
      // Gracefully ignore in browser preview environments.
    }
  }

  let systemPrefersDark = $state(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );

  const resolvedTheme = $derived(
    config.theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : config.theme
  );

  $effect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    syncNativeTitleBar(config.theme);
  });

  onMount(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenDbFail: (() => void) | undefined;

    (async () => {
      if (typeof window !== 'undefined') {
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        systemPrefersDark = mql.matches;
        mql.addEventListener('change', (e) => {
          systemPrefersDark = e.matches;
        });
      }

      // Show the window now that the UI is ready (avoids blank-screen flash on startup).
      try {
        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
      } catch {
        /* browser preview */
      }

      // Load persisted config from tauri-plugin-store.
      try {
        await loadConfig();
        initConfigWatcher();
      } catch {
        /* store unavailable in browser */
      }

      // Theme is automatically applied by $effect now.

      // Initialize session log file.
      try {
        await invoke(CMD_INIT_SESSION_LOG);
      } catch {
        /* ok */
      }

      // Query sidecar versions for the About modal.
      try {
        appState.ffmpegVersion = await invoke<string>(CMD_GET_SIDECAR_VERSION, {
          binaryName: 'ffmpeg'
        });
        appState.ffprobeVersion = await invoke<string>(CMD_GET_SIDECAR_VERSION, {
          binaryName: 'ffprobe'
        });
      } catch {
        /* sidecars may not be available in dev mode */
      }

      // Listen for backend log events.
      unlistenLog = await listen<string>(EVENT_PROCESS_LOG, (event) => {
        appendLog(event.payload);
      });

      // Listen for DB initialization failure.
      unlistenDbFail = await listen<string>(EVENT_DB_INIT_FAILED, (event) => {
        toast.warning(`Processing history unavailable: ${event.payload}`);
      });
    })();

    // Keyboard shortcut global listener.
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (unlistenLog) unlistenLog();
      if (unlistenDbFail) unlistenDbFail();
    };
  });
</script>

<div class="app-wrapper" data-theme={resolvedTheme}>
  {#if children}
    {@render children()}
  {/if}

  <ToastContainer />
</div>

<style lang="scss">
  .app-wrapper {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }
</style>
