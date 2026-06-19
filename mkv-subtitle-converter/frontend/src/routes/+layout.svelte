<script lang="ts">
  import '../styles/app.scss';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { handleKeydown } from '$lib/stores/shortcuts.svelte';
  import { appState, toggleTheme, loadConfig, initConfigWatcher } from '$lib/stores/config.svelte';
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

  async function syncNativeTitleBar(theme: string) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setTheme(theme === 'dark' ? 'dark' : 'light');
    } catch {
      // Gracefully ignore in browser preview environments.
    }
  }

  function handleToggleTheme() {
    toggleTheme();
    document.documentElement.setAttribute('data-theme', appState.isDarkMode ? 'dark' : 'light');
    syncNativeTitleBar(appState.isDarkMode ? 'dark' : 'light');
  }

  onMount(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenDbFail: (() => void) | undefined;

    (async () => {
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

      // Apply saved theme.
      const savedTheme = localStorage.getItem('app-theme') ?? 'dark';
      appState.isDarkMode = savedTheme === 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      await syncNativeTitleBar(savedTheme);

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

<div class="app-wrapper" data-theme={appState.isDarkMode ? 'dark' : 'light'}>
  <div class="titlebar-actions">
    <button
      class="theme-toggle"
      onclick={handleToggleTheme}
      aria-label={appState.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={appState.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {appState.isDarkMode ? '☀️' : '🌙'}
    </button>
  </div>

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

  .titlebar-actions {
    position: fixed;
    top: 12px;
    right: 14px;
    z-index: 900;
    display: flex;
    gap: 8px;
  }

  .theme-toggle {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text-primary);
    line-height: 1;

    &:hover {
      background: var(--bg-hover-panel);
      border-color: var(--accent-color);
    }
  }
</style>
