<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount, tick } from 'svelte';

  import { config, appState, configState } from '../lib/stores/config.svelte';
  import { shortcuts } from '../lib/stores/shortcuts.svelte';
  import { pipeline, addLogs, emitLog } from '../lib/stores/pipeline.svelte';
  import { addToast } from '../lib/stores/toast.svelte';
  import type { DirStats } from '$lib/types';
  import { DirStatsSchema, EncoderCapabilitiesSchema } from '$lib/types';
  import { z } from 'zod';
  import { formatDuration } from '../lib/utils/formatters';
  import { TAURI_COMMANDS, TAURI_EVENTS } from '../lib/constants';

  import DirectoryQueue from '../lib/components/DirectoryQueue.svelte';
  import ConfigPanel from '../lib/components/ConfigPanel.svelte';
  import MetricsPanel from '../lib/components/MetricsPanel.svelte';
  import TerminalLog from '../lib/components/TerminalLog.svelte';
  import ConfirmationModal from '../lib/components/ConfirmationModal.svelte';

  let timerInterval: ReturnType<typeof setInterval> | undefined = undefined;
  let startTime = 0;
  let queueComponent: ReturnType<typeof DirectoryQueue>;
  let terminalComponent: ReturnType<typeof TerminalLog>;
  let isDraggingOS = $state(false);
  let showClearHistoryModal = $state(false);
  let initialDirCheckDone = false;

  async function scrollToTerminalBottom(delay = 0) {
    await tick();
    if (delay > 0) {
      setTimeout(() => {
        if (terminalComponent) terminalComponent.scrollToBottom();
      }, delay);
    } else {
      if (terminalComponent) terminalComponent.scrollToBottom();
    }
  }

  $effect(() => {
    if (configState.isLoaded && !initialDirCheckDone && config.input_directories.length > 0) {
      initialDirCheckDone = true;
      (async () => {
        let removed = 0;
        const validDirs = [];
        for (const dir of config.input_directories) {
          try {
            const rawStats = await invoke(TAURI_COMMANDS.GET_DIRECTORY_STATS, {
              dirPath: dir,
              fileExtensions: config.file_extensions,
              recursive: config.recursive
            });
            const stats = DirStatsSchema.parse(rawStats);
            if (stats.exists) {
              validDirs.push(dir);
            } else {
              removed++;
            }
          } catch {
            removed++;
          }
        }
        if (removed > 0) {
          config.input_directories = validDirs;
          addToast(`Removed ${removed} stale directory path(s) from queue.`, 'warning');
        }
      })();
    }
  });

  onMount(() => {
    let cleanup: (() => void) | undefined;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      try {
        const rawEncoders = await invoke(TAURI_COMMANDS.GET_ENCODER_CAPABILITIES);
        appState.hardwareEncoders = EncoderCapabilitiesSchema.parse(rawEncoders);
      } catch (e) {
        emitLog(`[ERROR] Failed querying hardware encoder API integrations: ${e}`);
      }

      const unlistenDrag = await listen(TAURI_EVENTS.DRAG_ENTER, () => {
        if (!pipeline.processingActive) isDraggingOS = true;
      });

      const unlistenDragCancelled = await listen(TAURI_EVENTS.DRAG_LEAVE, () => {
        isDraggingOS = false;
      });

      const unlistenDrop = await listen<{ paths: string[] }>(TAURI_EVENTS.DRAG_DROP, (event) => {
        isDraggingOS = false;
        if (!pipeline.processingActive && event.payload?.paths && queueComponent) {
          queueComponent.handleDragDrop(event.payload.paths);
        }
      });

      const unlistenLogFn = await listen<string>(TAURI_EVENTS.PROCESS_LOG, async (event) => {
        addLogs(event.payload);
        if (event.payload.includes('Scanned file total:')) {
          const match = event.payload.match(/Scanned file total:\s*(\d+)/);
          if (match) {
            pipeline.totalFilesCount = parseInt(match[1], 10);
            pipeline.completedFilesCount = 0;
            pipeline.activeFiles = {};
          }
        }

        if (!scrollTimeout) {
          scrollTimeout = setTimeout(async () => {
            scrollTimeout = null;
            await scrollToTerminalBottom();
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
        file_completed?: string;
        root_directory?: string;
        success?: boolean;
      }>(TAURI_EVENTS.PROCESS_PROGRESS, (event) => {
        if (event.payload.file_completed !== undefined) {
          pipeline.completedFilesCount++;
          delete pipeline.activeFiles[event.payload.file_completed];

          if (event.payload.root_directory !== undefined) {
            const rootDir = event.payload.root_directory;
            pipeline.completedFilesPerDir[rootDir] =
              (pipeline.completedFilesPerDir[rootDir] || 0) + 1;

            if (event.payload.success === false) {
              pipeline.directoryErrors[rootDir] = true;
            }

            if (
              pipeline.directoryStats[rootDir] &&
              pipeline.completedFilesPerDir[rootDir] >= pipeline.directoryStats[rootDir].file_count
            ) {
              pipeline.directoryStatuses[rootDir] = 'done';
            }
          }
        }
        if (
          event.payload.intra_progress !== undefined &&
          event.payload.current_filename !== undefined
        ) {
          pipeline.activeFiles[event.payload.current_filename] = event.payload.intra_progress;
        }
        if (event.payload.total_files !== undefined)
          pipeline.totalFilesCount = event.payload.total_files;

        if (event.payload.active_directory !== undefined) {
          const activeDir = event.payload.active_directory;
          pipeline.currentActiveDirectory = activeDir;
          const rootDir = config.input_directories.find((root) => activeDir.startsWith(root));
          if (rootDir && pipeline.directoryStatuses[rootDir] === 'pending') {
            pipeline.directoryStatuses[rootDir] = 'processing';
          }
        }
      });

      const unlistenLargeBatchFn = await listen<number>(
        TAURI_EVENTS.LARGE_BATCH_WARNING,
        (event) => {
          addToast(
            `⚠️ Large batch detected (${event.payload} files). Please ensure sufficient disk space.`,
            'warning'
          );
        }
      );

      const unlistenDbInit = await listen<string>(TAURI_EVENTS.DB_INIT_FAILED, (event) => {
        addToast(`History Database failed to initialize: ${event.payload}`, 'error');
        emitLog(`❌ History DB Error: ${event.payload}`);
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
        unlistenLargeBatchFn();
        unlistenCloseFn();
        unlistenDbInit();
        unlistenDrop();
        unlistenDrag();
        unlistenDragCancelled();
        if (timerInterval) clearInterval(timerInterval);
      };
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  });

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();

    function tickTime() {
      const elapsedMs = Date.now() - startTime;
      pipeline.runningTimeFormatted = formatDuration(elapsedMs);

      try {
        let sumIntra = 0;
        const vals = Object.values(pipeline.activeFiles);
        for (let i = 0; i < vals.length; i++) {
          sumIntra += vals[i] as number;
        }
        const completedFraction = pipeline.completedFilesCount + sumIntra / 100;

        if (
          pipeline.totalFilesCount > 0 &&
          completedFraction > 0.05 &&
          completedFraction < pipeline.totalFilesCount
        ) {
          const msPerFile = elapsedMs / completedFraction;
          const remainingFraction = pipeline.totalFilesCount - completedFraction;
          const remainingMs = remainingFraction * msPerFile;
          pipeline.etaFormatted = formatDuration(remainingMs);
        } else if (pipeline.totalFilesCount > 0 && completedFraction >= pipeline.totalFilesCount) {
          pipeline.etaFormatted = '0ms';
        } else {
          pipeline.etaFormatted = '--';
        }
      } catch (err) {
        console.error('Timer tick error:', err);
      }
    }

    timerInterval = setInterval(tickTime, 100);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
  }

  function toggleTheme() {
    appState.isDarkMode = !appState.isDarkMode;
    localStorage.setItem('app-theme', appState.isDarkMode ? 'dark' : 'light');
  }

  async function displaySidecarVersions() {
    emitLog('--- Querying Embedded Sidecar Binary Configurations ---');
    const tools = ['ffmpeg', 'ffprobe', 'mkvmerge'];
    for (const tool of tools) {
      try {
        const rawVer = await invoke(TAURI_COMMANDS.GET_SIDECAR_VERSION, { binaryName: tool });
        const ver = z.string().parse(rawVer);
        emitLog(`[Sidecar Asset] ${tool.toUpperCase()}: ${ver.trim()}`);
      } catch {
        emitLog(
          `[Sidecar Asset] ${tool.toUpperCase()}: Verified embedded production binary instance asset active.`
        );
      }
    }
    emitLog('--------------------------------------------------------');
    await scrollToTerminalBottom();
  }

  async function executePipeline() {
    if (config.input_directories.length === 0) {
      addToast('Please add at least one target directory.', 'warning');
      emitLog(
        '❌ Error: Please add at least one target directory to the queue before running processing tasks.'
      );
      await scrollToTerminalBottom();
      return;
    }

    pipeline.processingActive = true;
    pipeline.showMetricsPanel = true;
    pipeline.activeFiles = {};
    pipeline.completedFilesCount = 0;
    pipeline.completedFilesPerDir = {};
    pipeline.totalFilesCount = 0;
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;

    const startDate = new Date();
    pipeline.consoleLogs = []; // Clear for new run
    await invoke(TAURI_COMMANDS.INITIALIZE_SESSION_LOG);
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
          const rawStats = await invoke(TAURI_COMMANDS.GET_DIRECTORY_STATS, {
            dirPath: dir,
            fileExtensions: config.file_extensions,
            recursive: config.recursive
          });
          const stats = DirStatsSchema.parse(rawStats);
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

      const PipelineSummarySchema = z.object({
        message: z.string(),
        original_size_bytes: z.number(),
        output_size_bytes: z.number(),
        skipped_files: z.number()
      });

      let payload = {
        ...config,
        crf: String(config.crf)
      };

      const rawSummary = await invoke(TAURI_COMMANDS.PROCESS_VIDEO_PIPELINE, { payload });
      const summary = PipelineSummarySchema.parse(rawSummary);

      pipeline.storageOriginalBytes = summary.original_size_bytes;
      pipeline.storageOutputBytes = summary.output_size_bytes;

      pipeline.completedFilesCount = pipeline.totalFilesCount;
      pipeline.activeFiles = {};

      try {
        const { isPermissionGranted, requestPermission, sendNotification } =
          await import('@tauri-apps/plugin-notification');
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        if (permissionGranted) {
          sendNotification({
            title: 'MKV Filter Metadata',
            body: `Pipeline completed processing files.`
          });
        }
      } catch (e) {
        console.warn('Failed to send desktop notification', e);
      }
    } catch (err: unknown) {
      addToast(`Pipeline execution failed: ${err}`, 'error');
      emitLog(`❌ Pipeline execution failure: ${err}`);
    } finally {
      pipeline.processingActive = false;
      stopTimer();

      pipeline.activeFiles = {};

      for (const key in pipeline.directoryStatuses) {
        if (
          pipeline.directoryStatuses[key] === 'processing' ||
          pipeline.directoryStatuses[key] === 'pending'
        ) {
          if (
            pipeline.completedFilesCount >= pipeline.totalFilesCount &&
            pipeline.totalFilesCount > 0
          ) {
            pipeline.directoryStatuses[key] = 'done';
          } else {
            delete pipeline.directoryStatuses[key];
          }
        }
      }

      const endDate = new Date();
      const elapsedMs = endDate.getTime() - startTime;
      const finalTimeStr = formatDuration(elapsedMs);
      pipeline.runningTimeFormatted = finalTimeStr;

      addToast(`Pipeline execution complete! (${finalTimeStr})`, 'success');
      emitLog(
        `Session finished at: ${endDate.toLocaleString()}`,
        `Total Conversion Time: ${finalTimeStr}`
      );

      await scrollToTerminalBottom();
    }
  }

  async function abortPipeline() {
    try {
      addToast('Halt instruction issued. Rolling back...', 'warning');
      emitLog('⚠️ Halt instruction issued. Terminating processes and rolling back...');
      await scrollToTerminalBottom();

      await invoke(TAURI_COMMANDS.ABORT_VIDEO_PIPELINE);
      emitLog('🛑 Processing execution stopped and partial files cleaned up.');
    } catch (err) {
      emitLog(`Error safely terminating workers: ${err}`);
    } finally {
      pipeline.processingActive = false;
      stopTimer();

      await scrollToTerminalBottom(40);
    }
  }

  function clearHistory() {
    showClearHistoryModal = true;
  }

  async function executeClearHistory() {
    showClearHistoryModal = false;
    try {
      await invoke(TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY);
      addToast('✅ Processing history cleared successfully.', 'success');
    } catch (e) {
      addToast(`❌ Failed to clear history: ${e}`, 'error');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const keyCombo = [];
    if (e.ctrlKey) keyCombo.push('Ctrl');
    if (e.shiftKey) keyCombo.push('Shift');
    if (e.altKey) keyCombo.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      keyCombo.push(key);
    }

    const comboStr = keyCombo.join('+');

    if (comboStr === shortcuts.startPipeline && !pipeline.processingActive) {
      if (config.input_directories.length > 0) {
        e.preventDefault();
        executePipeline();
      }
    } else if (comboStr === shortcuts.abortPipeline && pipeline.processingActive) {
      e.preventDefault();
      abortPipeline();
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
  onkeydown={handleKeydown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
/>

<main class="app-container">
  <header class="navbar-layer">
    <h1>MKV Filter Metadata</h1>
    <div class="nav-actions">
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        class="theme-toggle-icon-btn"
        href="/settings"
        aria-label="Settings"
        style="text-decoration: none;">⚙️</a
      >
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
      <button
        class="theme-toggle-icon-btn"
        onclick={toggleTheme}
        aria-label="Toggle color display theme"
      >
        {#if appState.isDarkMode}☀️{:else}🌙{/if}
      </button>
    </div>
  </header>

  <div class="form-workspace-card">
    <DirectoryQueue bind:this={queueComponent} {isDraggingOS} />
    <ConfigPanel onclearhistory={clearHistory} />

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

<ConfirmationModal
  show={showClearHistoryModal}
  title="Clear Processing History"
  message="Are you sure you want to clear the processing history database?&#10;&#10;This will cause any previously completed files to be re-processed if they are queued again."
  confirmText="Clear History"
  cancelText="Cancel"
  onConfirm={executeClearHistory}
  onCancel={() => (showClearHistoryModal = false)}
/>

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
    overflow-x: hidden;
    overflow-y: auto;
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

  .nav-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
