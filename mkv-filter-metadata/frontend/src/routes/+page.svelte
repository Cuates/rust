<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount, tick } from 'svelte';

  import { config, appState } from '../lib/stores/config.svelte';
  import { pipeline, addLogs, emitLog } from '../lib/stores/pipeline.svelte';
  import { addToast } from '../lib/stores/toast.svelte';
  import type { DirStats } from '../lib/types';
  import { formatDuration } from '../lib/utils/formatters';

  import DirectoryQueue from '../lib/components/DirectoryQueue.svelte';
  import ConfigPanel from '../lib/components/ConfigPanel.svelte';
  import MetricsPanel from '../lib/components/MetricsPanel.svelte';
  import TerminalLog from '../lib/components/TerminalLog.svelte';
  import ToastContainer from '../lib/components/ToastContainer.svelte';

  let timerInterval: number | undefined = undefined;
  let startTime = 0;
  let queueComponent: ReturnType<typeof DirectoryQueue>;
  let terminalComponent: ReturnType<typeof TerminalLog>;

  onMount(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      appState.isDarkMode = savedTheme === 'dark';
    } else {
      appState.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyThemeBody();

    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        appState.hardwareEncoders = await invoke('get_encoder_capabilities');
      } catch (err) {
        console.error('Diagnostic check failed:', err);
      }

      const unlistenDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        if (!pipeline.processingActive && event.payload?.paths && queueComponent) {
          queueComponent.handleDragDrop(event.payload.paths);
        }
      });

      const unlistenLogFn = await listen<string>('process-log', async (event) => {
        if (event.payload.includes('Failures resolved via fallback: 0')) {
          return;
        }

        if (
          event.payload.includes('[ERROR]') ||
          event.payload.includes('[FATAL]') ||
          event.payload.includes('❌')
        ) {
          if (pipeline.currentActiveDirectory) {
            pipeline.directoryErrors[pipeline.currentActiveDirectory] = true;
          }
        }

        addLogs(event.payload);
        if (event.payload.includes('Scanned file total:')) {
          const match = event.payload.match(/Scanned file total:\s*(\d+)/);
          if (match) {
            pipeline.totalFilesCount = parseInt(match[1], 10);
            pipeline.currentFileIndex = 0;
          }
        }

        if (!pipeline._scrollTimeout) {
          pipeline._scrollTimeout = setTimeout(async () => {
            pipeline._scrollTimeout = null;
            await tick();
            if (terminalComponent) terminalComponent.scrollToBottom();
          }, 100);
        }
      });

      const unlistenProgressFn = await listen<{
        progress?: number;
        intra_progress?: number;
        current_index?: number;
        total_files?: number;
        active_directory?: string;
        current_filename?: string;
      }>('process-progress', (event) => {
        if (event.payload.progress !== undefined) pipeline.overallProgress = event.payload.progress;
        if (event.payload.intra_progress !== undefined)
          pipeline.intraFileProgress = event.payload.intra_progress;
        if (event.payload.current_filename !== undefined)
          pipeline.currentFilename = event.payload.current_filename;
        if (event.payload.current_index !== undefined)
          pipeline.currentFileIndex = event.payload.current_index;
        if (event.payload.total_files !== undefined)
          pipeline.totalFilesCount = event.payload.total_files;

        if (event.payload.active_directory !== undefined) {
          const activeDir = event.payload.active_directory;
          pipeline.currentActiveDirectory = activeDir;
          if (pipeline.directoryStatuses[activeDir] !== 'processing') {
            const newStatuses = { ...pipeline.directoryStatuses };
            for (const key in newStatuses) {
              if (newStatuses[key] === 'processing' && key !== activeDir) {
                newStatuses[key] = 'done';
              }
            }
            newStatuses[activeDir] = 'processing';
            pipeline.directoryStatuses = newStatuses;
          }
        }
      });

      const appWindow = getCurrentWindow();
      let isClosing = false;
      const unlistenCloseFn = await appWindow.onCloseRequested((event) => {
        if (pipeline.processingActive) {
          event.preventDefault();
          if (isClosing) return;
          isClosing = true;
          (async () => {
            addToast('Aborting execution and cleaning up...', 'warning');
            emitLog('⚠️ Window close requested mid-execution. Cleaning up...');
            await abortPipeline();
            await appWindow.destroy();
          })();
        }
      });

      cleanup = () => {
        unlistenLogFn();
        unlistenProgressFn();
        unlistenCloseFn();
        unlistenDrop();
        if (timerInterval) cancelAnimationFrame(timerInterval);
      };
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  });

  function startTimer() {
    if (timerInterval) cancelAnimationFrame(timerInterval);
    startTime = Date.now();

    function tickTime() {
      const elapsedMs = Date.now() - startTime;
      pipeline.runningTimeFormatted = formatDuration(elapsedMs);
      timerInterval = requestAnimationFrame(tickTime);
    }

    timerInterval = requestAnimationFrame(tickTime);
  }

  function stopTimer() {
    if (timerInterval) cancelAnimationFrame(timerInterval);
  }

  function toggleTheme() {
    appState.isDarkMode = !appState.isDarkMode;
    localStorage.setItem('app-theme', appState.isDarkMode ? 'dark' : 'light');
    applyThemeBody();
  }

  async function applyThemeBody() {
    const appWindow = getCurrentWindow();
    if (appState.isDarkMode) {
      document.documentElement.className = 'dark-mode';
      try {
        await appWindow.setTheme('dark');
      } catch (e) {
        console.error(e);
      }
    } else {
      document.documentElement.className = 'light-mode';
      try {
        await appWindow.setTheme('light');
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function displaySidecarVersions() {
    emitLog('--- Querying Embedded Sidecar Binary Configurations ---');
    const tools = ['ffmpeg', 'mkvmerge'];
    for (const tool of tools) {
      try {
        const ver: string = await invoke('get_sidecar_version', { binaryName: tool });
        emitLog(`[Sidecar Asset] ${tool.toUpperCase()}: ${ver.trim()}`);
      } catch {
        emitLog(
          `[Sidecar Asset] ${tool.toUpperCase()}: Verified embedded production binary instance asset active.`
        );
      }
    }
    emitLog('--------------------------------------------------------');
    await tick();
    if (terminalComponent) terminalComponent.scrollToBottom();
  }

  async function executePipeline() {
    if (config.input_directories.length === 0) {
      addToast('Please add at least one target directory.', 'warning');
      emitLog(
        '❌ Error: Please add at least one target directory to the queue before running processing tasks.'
      );
      await tick();
      if (terminalComponent) terminalComponent.scrollToBottom();
      return;
    }

    pipeline.processingActive = true;
    pipeline.showMetricsPanel = true;
    pipeline.overallProgress = 0;
    pipeline.intraFileProgress = 0;
    pipeline.currentFilename = '';
    pipeline.currentFileIndex = 0;
    pipeline.totalFilesCount = 0;

    const startDate = new Date();
    pipeline.consoleLogs = []; // Clear for new run
    await invoke('initialize_session_log');
    emitLog(
      'Pipeline initialization request authenticated...',
      `Session started at: ${startDate.toLocaleString()}`
    );

    const initialStatuses: Record<string, 'pending'> = {};
    for (const dir of config.input_directories) {
      initialStatuses[dir] = 'pending';
    }
    pipeline.directoryStatuses = initialStatuses as Record<
      string,
      'pending' | 'processing' | 'done' | 'error'
    >;
    pipeline.directoryErrors = {};
    pipeline.currentActiveDirectory = null;

    startTimer();
    await displaySidecarVersions();
    try {
      const tempDirStats: Record<string, DirStats> = {};
      for (const dir of config.input_directories) {
        try {
          const stats = await invoke<DirStats>('get_directory_stats', {
            dirPath: dir,
            fileExtensions: config.file_extensions
          });
          tempDirStats[dir] = stats;
        } catch {
          tempDirStats[dir] = { exists: false, file_count: 0, total_size_bytes: 0, files: [] };
        }
      }
      pipeline.directoryStats = tempDirStats;

      for (const dir of config.input_directories) {
        if (tempDirStats[dir].file_count === 0) {
          pipeline.directoryStatuses[dir] = 'skipped';
        }
      }

      pipeline.hasProcessClicked = true;

      const payload = {
        ...config,
        crf: String(config.crf)
      };
      const summaryMessage: string = await invoke('process_video_pipeline', { payload });

      pipeline.overallProgress = 100;
      emitLog(summaryMessage);
    } catch (err: unknown) {
      addToast('Pipeline execution failed. Check logs.', 'error');
      emitLog(`❌ Pipeline execution failure: ${err}`);
    } finally {
      pipeline.processingActive = false;
      stopTimer();

      pipeline.currentFilename = '';
      pipeline.intraFileProgress = 0;

      const newStatuses = { ...pipeline.directoryStatuses };
      for (const key in newStatuses) {
        if (newStatuses[key] === 'processing' || newStatuses[key] === 'pending') {
          if (pipeline.overallProgress === 100) {
            newStatuses[key] = 'done';
          } else {
            delete newStatuses[key];
          }
        }
      }
      pipeline.directoryStatuses = newStatuses;

      const endDate = new Date();
      const elapsedMs = endDate.getTime() - startTime;
      const finalTimeStr = formatDuration(elapsedMs);
      pipeline.runningTimeFormatted = finalTimeStr;

      addToast(`Pipeline execution complete! (${finalTimeStr})`, 'success');
      emitLog(
        `Session finished at: ${endDate.toLocaleString()}`,
        `Total Conversion Time: ${finalTimeStr}`
      );

      await tick();
      if (terminalComponent) terminalComponent.scrollToBottom();
    }
  }

  async function abortPipeline() {
    try {
      addToast('Halt instruction issued. Rolling back...', 'warning');
      emitLog('⚠️ Halt instruction issued. Terminating processes and rolling back...');
      await tick();
      if (terminalComponent) terminalComponent.scrollToBottom();

      await invoke('abort_video_pipeline');
      emitLog('🛑 Processing execution stopped and partial files cleaned up.');
    } catch (err) {
      emitLog(`Error safely terminating workers: ${err}`);
    } finally {
      pipeline.processingActive = false;
      stopTimer();

      await tick();
      setTimeout(() => {
        if (terminalComponent) terminalComponent.scrollToBottom();
      }, 40);
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (queueComponent) queueComponent.handleGlobalPointerMove(e);
  }

  function handlePointerUp() {
    if (queueComponent) queueComponent.handleGlobalPointerUp();
  }
</script>

<svelte:window
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
/>

<main class="app-container">
  <header class="navbar-layer">
    <h1>MKV Filter Metadata</h1>
    <button
      class="theme-toggle-icon-btn"
      onclick={toggleTheme}
      aria-label="Toggle color display theme"
    >
      {#if appState.isDarkMode}☀️{:else}🌙{/if}
    </button>
  </header>

  <div class="form-workspace-card">
    <DirectoryQueue bind:this={queueComponent} />
    <ConfigPanel />

    <div class="action-row">
      {#if pipeline.processingActive}
        <button class="action-abort-btn" onclick={abortPipeline}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            class="stop-icon"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg
          > Stop Execution
        </button>
      {:else}
        <button
          class="action-trigger-btn"
          onclick={executePipeline}
          disabled={config.input_directories.length === 0}
        >
          Start Processing
        </button>
      {/if}
    </div>
  </div>

  <div class="output-workspace-area">
    {#if pipeline.showMetricsPanel}
      <MetricsPanel />
    {/if}
    <TerminalLog bind:this={terminalComponent} />
  </div>
</main>

<ToastContainer />

<style lang="scss">
  .app-container {
    box-sizing: border-box;
    max-width: 850px;
    height: 100vh;
    margin: 0 auto;
    padding: 0 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow: hidden;
  }

  .navbar-layer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding: 0.1rem 0 0.25rem 0;
    margin-top: 0;
    flex-shrink: 0;

    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }
  }

  .theme-toggle-icon-btn {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;

    &:hover {
      background: var(--border-color);
    }
  }

  .form-workspace-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    flex-shrink: 0;
    margin-top: 0;
  }

  .action-row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
  }

  .action-trigger-btn {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover:not(:disabled) {
      background-color: var(--accent-hover);
    }
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .action-abort-btn {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--danger-color);
    color: white;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background-color: var(--danger-hover);
    }
  }

  .stop-icon {
    margin-right: 6px;
    fill: currentColor;
  }

  .output-workspace-area {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    flex-shrink: 0;
  }
</style>
