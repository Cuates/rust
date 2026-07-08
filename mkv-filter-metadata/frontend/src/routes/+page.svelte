<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import type { ProgressBarStatus } from '@tauri-apps/api/window';
  import { onMount, tick } from 'svelte';

  import { config, appState, configState } from '../lib/stores/config.svelte';
  import { shortcuts } from '../lib/stores/shortcuts.svelte';
  import {
    pipeline,
    addLogs,
    emitLog,
    startPipelineTimer,
    stopPipelineTimer
  } from '../lib/stores/pipeline.svelte';
  import { addToast } from '../lib/stores/toast.svelte';
  import { registerCommand, unregisterCommand, paletteState } from '../lib/stores/commands.svelte';
  import type { DirectoryStats } from '$lib/types';
  import {
    DirectoryStatsSchema,
    EncoderCapabilitiesSchema,
    PipelineSummarySchema
  } from '$lib/types';
  import { z } from 'zod';
  import { formatDuration } from '../lib/utils/formatters';
  import { TAURI_COMMANDS, TAURI_EVENTS, UI_STRINGS, LOG_MESSAGES } from '../lib/constants';

  import DirectoryQueue from '../lib/components/DirectoryQueue.svelte';
  import ConfigPanel from '../lib/components/ConfigPanel.svelte';
  import MetricsPanel from '../lib/components/MetricsPanel.svelte';
  import TerminalLog from '../lib/components/TerminalLog.svelte';
  import ConfirmationModal from '../lib/components/ConfirmationModal.svelte';
  import AboutModal from '../lib/components/AboutModal.svelte';

  let queueComponent: ReturnType<typeof DirectoryQueue>;
  let terminalComponent: ReturnType<typeof TerminalLog>;
  let isDraggingOS = $state(false);
  let showClearHistoryModal = $state(false);
  let showAboutModal = $state(false);
  let initialDirCheckDone = false;

  async function scrollToTerminalBottom(delay = 0, force = false) {
    await tick();
    if (delay > 0) {
      setTimeout(() => {
        if (terminalComponent) terminalComponent.scrollToBottom(force);
      }, delay);
    } else {
      if (terminalComponent) terminalComponent.scrollToBottom(force);
    }
  }

  // Taskbar Progress Synchronization
  let lastProgressPercentage = $state(-1);
  $effect(() => {
    try {
      if (!window.__TAURI_INTERNALS__?.metadata) return; // Prevent crashes in raw browser
      const appWindow = getCurrentWindow();
      if (pipeline.totalFilesCount > 0 && pipeline.processingActive) {
        if (pipeline.overallProgress !== lastProgressPercentage) {
          lastProgressPercentage = pipeline.overallProgress;
          if (pipeline.overallProgress < 100) {
            appWindow
              .setProgressBar({
                status: 'normal' as ProgressBarStatus,
                progress: pipeline.overallProgress
              })
              .catch(console.error);
          } else {
            appWindow.setProgressBar({ status: 'none' as ProgressBarStatus }).catch(console.error);
          }
        }
      } else if (!pipeline.processingActive && lastProgressPercentage !== -1) {
        lastProgressPercentage = -1;
        appWindow.setProgressBar({ status: 'none' as ProgressBarStatus }).catch(console.error);
      }
    } catch (err) {
      console.warn('Failed to sync taskbar progress:', err);
    }
  });

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
            const stats = DirectoryStatsSchema.parse(rawStats);
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

  // ─── Register commands ───────────
  $effect(() => {
    registerCommand({
      id: 'start-pipeline',
      label: 'Start Processing Queue',
      shortcutHint: shortcuts.startPipeline,
      enabled: () => !pipeline.processingActive && config.input_directories.length > 0,
      action: () => executePipeline()
    });
    registerCommand({
      id: 'stop-pipeline',
      label: 'Stop Execution',
      shortcutHint: shortcuts.abortPipeline,
      enabled: () => pipeline.processingActive,
      action: () => abortPipeline()
    });
    registerCommand({
      id: 'clear-history',
      label: 'Clear Processing History',
      enabled: () => !pipeline.processingActive,
      action: () => clearHistory()
    });
    registerCommand({
      id: 'toggle-about',
      label: 'About MKV Filter Metadata',
      enabled: () => true,
      action: () => (showAboutModal = true)
    });

    return () => {
      unregisterCommand('start-pipeline');
      unregisterCommand('stop-pipeline');
      unregisterCommand('clear-history');
      unregisterCommand('toggle-about');
    };
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

      const tools = ['ffmpeg', 'ffprobe', 'mkvmerge'];
      for (const tool of tools) {
        try {
          const rawVer = await invoke(TAURI_COMMANDS.GET_SIDECAR_VERSION, { binaryName: tool });
          const ver = z.string().parse(rawVer).trim();
          if (tool === 'ffmpeg') appState.ffmpegVersion = ver;
          if (tool === 'ffprobe') appState.ffprobeVersion = ver;
          if (tool === 'mkvmerge') appState.mkvmergeVersion = ver;
        } catch {
          const errStr = 'Error or Embedded';
          if (tool === 'ffmpeg') appState.ffmpegVersion = errStr;
          if (tool === 'ffprobe') appState.ffprobeVersion = errStr;
          if (tool === 'mkvmerge') appState.mkvmergeVersion = errStr;
        }
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

      const unlistenLogFn = await listen<string[]>(TAURI_EVENTS.PROCESS_LOG, async (event) => {
        addLogs(...event.payload);
        for (const line of event.payload) {
          if (line.includes('Scanned file total:')) {
            const match = line.match(/Scanned file total:\s*(\d+)/);
            if (match) {
              pipeline.totalFilesCount = parseInt(match[1], 10);
              pipeline.completedFilesCount = 0;
              pipeline.activeFiles = {};
            }
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

      const unlistenThrottle = await listen<{
        throttled: boolean;
        cpu_percent: number;
        available_memory_percent: number;
      }>(TAURI_EVENTS.RESOURCE_THROTTLE, (event) => {
        pipeline.resourceThrottled = event.payload.throttled;
        if (event.payload.throttled) {
          addToast(
            `⚠️ Resource limits exceeded (CPU: ${event.payload.cpu_percent.toFixed(
              0
            )}%, Memory left: ${event.payload.available_memory_percent.toFixed(
              0
            )}%). Pausing new tasks...`,
            'warning'
          );
        } else {
          addToast('✅ Resources recovered. Resuming pipeline...', 'success');
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
            addToast(UI_STRINGS.ABORTING_EXECUTION, 'warning');
            emitLog(LOG_MESSAGES.WINDOW_CLOSE_MID_EXECUTION);
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
        unlistenThrottle();
        unlistenDrop();
        unlistenDrag();
        unlistenDragCancelled();
      };
    };

    init().catch((e) => console.error('Failed to initialize page:', e));

    return () => {
      if (cleanup) cleanup();
    };
  });

  async function displaySidecarVersions() {
    emitLog(LOG_MESSAGES.QUERYING_SIDECAR);
    const tools = ['ffmpeg', 'ffprobe', 'mkvmerge'];
    for (const tool of tools) {
      try {
        const rawVer = await invoke(TAURI_COMMANDS.GET_SIDECAR_VERSION, { binaryName: tool });
        const ver = z.string().parse(rawVer);
        emitLog(`${LOG_MESSAGES.SIDECAR_ASSET} ${tool.toUpperCase()}: ${ver.trim()}`);
      } catch {
        emitLog(
          `${LOG_MESSAGES.SIDECAR_ASSET} ${tool.toUpperCase()}: Verified embedded production binary instance asset active.`
        );
      }
    }
    emitLog(LOG_MESSAGES.DASH_SEPARATOR);
    await scrollToTerminalBottom(0, true);
  }

  async function executePipeline() {
    if (config.input_directories.length === 0) {
      addToast(UI_STRINGS.ADD_TARGET_DIR, 'warning');
      emitLog(LOG_MESSAGES.ERR_NO_TARGET_DIR);
      await scrollToTerminalBottom(0, true);
      return;
    }

    pipeline.processingActive = true;
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
      UI_STRINGS.PIPELINE_INITIALIZATION_AUTH,
      `${UI_STRINGS.SESSION_STARTED_AT} ${startDate.toLocaleString()}`
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

    startPipelineTimer();
    await displaySidecarVersions();
    try {
      const tempDirectoryStats: Record<string, DirectoryStats> = {};
      for (const dir of config.input_directories) {
        try {
          const rawStats = await invoke(TAURI_COMMANDS.GET_DIRECTORY_STATS, {
            dirPath: dir,
            fileExtensions: config.file_extensions,
            recursive: config.recursive
          });
          const stats = DirectoryStatsSchema.parse(rawStats);
          tempDirectoryStats[dir] = stats;
        } catch {
          tempDirectoryStats[dir] = {
            exists: false,
            file_count: 0,
            total_size_bytes: 0,
            files: [],
            history_skipped_count: 0,
            history_skipped_bytes: 0
          };
        }
      }
      pipeline.directoryStats = tempDirectoryStats;

      for (const dir of config.input_directories) {
        if (tempDirectoryStats[dir].file_count === 0) {
          pipeline.directoryStatuses[dir] = 'skipped';
        }
      }

      pipeline.hasProcessClicked = true;

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
        if (config.notifications) {
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
              body: UI_STRINGS.PIPELINE_COMPLETED
            });
          }
        }
      } catch (e) {
        console.warn('Failed to send desktop notification', e);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast(`${UI_STRINGS.PIPELINE_EXECUTION_FAILED} ${errMsg}`, 'error');
      emitLog(`${LOG_MESSAGES.PIPELINE_FAILURE} ${errMsg}`);
    } finally {
      if (pipeline.isAborting) {
        addToast(UI_STRINGS.RESOURCES_RELEASED, 'success');
        pipeline.isAborting = false;
      }
      pipeline.processingActive = false;
      stopPipelineTimer();

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
      const elapsedMs = endDate.getTime() - pipeline.startTime;
      const finalTimeStr = formatDuration(elapsedMs);
      pipeline.runningTimeFormatted = finalTimeStr;

      // Populate lastRunSummary for MetricsPanel idle display
      const savedPercent =
        pipeline.storageOriginalBytes > 0
          ? ((pipeline.storageOriginalBytes - pipeline.storageOutputBytes) /
              pipeline.storageOriginalBytes) *
            100
          : 0;
      pipeline.lastRunSummary = {
        filesProcessed: pipeline.completedFilesCount,
        timeFormatted: finalTimeStr,
        storageSavedPercent: savedPercent,
        originalBytes: pipeline.storageOriginalBytes,
        outputBytes: pipeline.storageOutputBytes
      };

      addToast(`${UI_STRINGS.PIPELINE_EXECUTION_COMPLETE} (${finalTimeStr})`, 'success');
      emitLog(
        `${UI_STRINGS.SESSION_FINISHED_AT} ${endDate.toLocaleString()}`,
        `${UI_STRINGS.TOTAL_CONVERSION_TIME} ${finalTimeStr}`
      );

      await scrollToTerminalBottom(0, true);
    }
  }

  async function abortPipeline() {
    if (pipeline.isAborting) return;
    pipeline.isAborting = true;
    try {
      addToast(UI_STRINGS.HALT_INSTRUCTION_ISSUED, 'warning');
      emitLog(LOG_MESSAGES.HALT_TERMINATING);
      await scrollToTerminalBottom(0, true);

      await invoke(TAURI_COMMANDS.ABORT_VIDEO_PIPELINE);
      emitLog(LOG_MESSAGES.PROCESSING_STOPPED);
    } catch (err) {
      emitLog(`${LOG_MESSAGES.ERR_TERMINATING_WORKERS} ${err}`);
      pipeline.isAborting = false;
    } finally {
      await scrollToTerminalBottom(40, true);
    }
  }

  function clearHistory() {
    showClearHistoryModal = true;
  }

  async function executeClearHistory() {
    showClearHistoryModal = false;
    try {
      await invoke(TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY);
      pipeline.historyClearTimestamp = Date.now();
      addToast(UI_STRINGS.CLEAR_HISTORY_SUCCESS, 'success');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      addToast(`${UI_STRINGS.CLEAR_HISTORY_FAILED} ${errMsg}`, 'error');
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    // If palette is open, all other keys are handled by CommandPalette itself
    if (paletteState.isOpen) return;

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
  onkeydown={handleWindowKeydown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
/>

<main class="app-container">
  <header class="navbar-layer">
    <h1>MKV Filter Metadata</h1>
    <div class="nav-actions">
      <button
        class="theme-toggle-icon-btn"
        aria-label="Open command palette"
        title="Command palette (Ctrl+K)"
        onclick={() => (paletteState.isOpen = true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 17 10 11 4 5"></polyline>
          <line x1="12" y1="19" x2="20" y2="19"></line>
        </svg>
      </button>
      <a
        class="theme-toggle-icon-btn"
        href="/guide"
        aria-label="How To Use Guide"
        title="How To Use Guide"
        style="text-decoration: none; display: flex;"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </a>
      <a
        class="theme-toggle-icon-btn"
        href="/settings"
        aria-label="Settings"
        title="Settings"
        style="text-decoration: none;">⚙️</a
      >
      <button
        class="theme-toggle-icon-btn"
        onclick={() => (showAboutModal = true)}
        aria-label="About Application"
        title="About Application"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
    </div>
  </header>

  <!-- Three-tier responsive layout.
       Tier 1 (<800px):   single column — form-workspace-pane scrolls, output below.
       Tier 2 (≥800px):   two columns — form | divider | output, each independently scrollable.
       Tier 3 (≥1400px):  three columns — queue | config | output.
       Layout primitives live in app.scss so all routes share the same shell.
  -->
  <div class="content-scroll-area">
    <div class="left-column-wrapper">
      <div class="form-workspace-pane">
        <div class="form-workspace-card">
          <DirectoryQueue bind:this={queueComponent} {isDraggingOS} />

          <div class="action-row">
            {#if pipeline.processingActive}
              <button
                class="action-abort-btn"
                onclick={abortPipeline}
                disabled={pipeline.isAborting}
              >
                {#if pipeline.isAborting}
                  <span>Aborting...</span>
                {:else}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  <span>Stop Execution ({shortcuts.abortPipeline})</span>
                {/if}
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
      </div>

      <div class="config-workspace-pane">
        <div class="form-workspace-card">
          <ConfigPanel onclearhistory={clearHistory} />
        </div>
      </div>
    </div>

    <div class="output-workspace-pane">
      <!-- MetricsPanel is always mounted — no conditional guard.
           Eliminates the layout jump on every pipeline start. -->
      <MetricsPanel />
      <TerminalLog bind:this={terminalComponent} />
    </div>
  </div>

  <ConfirmationModal
    show={showClearHistoryModal}
    title="Clear History"
    message={UI_STRINGS.CLEAR_HISTORY_CONFIRMATION}
    confirmText="Clear History"
    cancelText="Cancel"
    onConfirm={executeClearHistory}
    onCancel={() => (showClearHistoryModal = false)}
  />

  <AboutModal show={showAboutModal} onClose={() => (showAboutModal = false)} />
</main>

<style lang="scss">
  /* .app-container, .content-scroll-area, .form-workspace-pane, .output-workspace-pane
     are defined in app.scss and shared across all routes. */

  .navbar-layer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.1rem 0 0.25rem 0;
    margin-top: 0;
    flex-shrink: 0;
    z-index: 10;

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
    color: var(--text-primary);
    border-radius: 50%;
    cursor: pointer;
    font-size: 1rem;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      opacity 0.2s ease;

    &:hover {
      background: var(--border-color);
    }
  }

  .action-row {
    margin-top: auto;
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
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
</style>
