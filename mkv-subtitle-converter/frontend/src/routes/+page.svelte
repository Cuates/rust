<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke, Channel } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow, ProgressBarStatus } from '@tauri-apps/api/window';
  import { open } from '@tauri-apps/plugin-dialog';
  import { sendNotification } from '@tauri-apps/plugin-notification';

  import DirectoryQueue from '$lib/components/DirectoryQueue.svelte';
  import MetricsPanel from '$lib/components/MetricsPanel.svelte';
  import TerminalLog from '$lib/components/TerminalLog.svelte';
  import AboutModal from '$lib/components/AboutModal.svelte';
  import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

  import { config, configState } from '$lib/stores/config.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    pipeline,
    resetPipeline,
    startPipelineTimer,
    stopPipelineTimer,
    handleStartedScanned,
    handleFileProcessed,
    handleFinished,
    handleCancelled,
    handleFolderStatusUpdate
  } from '$lib/stores/pipeline.svelte';
  import { registerShortcut } from '$lib/stores/shortcuts.svelte';

  import { FileProcessedDataSchema, FinishedDataSchema } from '$lib/types';
  import {
    CMD_PROCESS_MKV_DIRECTORY,
    CMD_ABORT_PROCESSING,
    CMD_CLEAR_PROCESSING_HISTORY,
    EVENT_LARGE_BATCH_WARNING
  } from '$lib/constants';

  // UI state
  let showAbout = $state(false);
  let showClearHistoryConfirm = $state(false);
  let isDragging = $state(false);

  // Derived from config
  const selectedFolders = $derived(config.input_directories);

  // Derived from pipeline
  const isProcessing = $derived(pipeline.status === 'processing' || pipeline.status === 'scanning');
  const pipelineProgress = $derived(
    pipeline.totalFiles > 0
      ? Math.min(100, (pipeline.filesProcessed / pipeline.totalFiles) * 100)
      : 0
  );

  // -------------------------------------------------------------------------
  // Folder Management
  // -------------------------------------------------------------------------

  async function addFolder() {
    if (isProcessing) return;
    try {
      const selected = await open({ directory: true, multiple: true });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      let added = false;
      for (const p of paths) {
        if (!config.input_directories.includes(p)) {
          config.input_directories = [...config.input_directories, p];
          added = true;
        }
      }
      if (added && pipeline.status === 'done') {
        pipeline.status = 'idle';
      }
    } catch (e) {
      toast.error(`Failed to open folder dialog: ${e}`);
    }
  }

  function removeFolder(folder: string) {
    config.input_directories = config.input_directories.filter((f) => f !== folder);
    if (config.input_directories.length === 0) {
      resetPipeline();
    }
  }

  function clearAllFolders() {
    config.input_directories = [];
    resetPipeline();
  }

  function reorderFolders(newFolders: string[]) {
    config.input_directories = newFolders;
  }

  // -------------------------------------------------------------------------
  // Drag & Drop
  // -------------------------------------------------------------------------

  onMount(() => {
    let unlistenDragEnter: (() => void) | undefined;
    let unlistenBatch: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const webview = getCurrentWebview();

        unlistenDragEnter = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            if (!isProcessing) isDragging = true;
          } else if (event.payload.type === 'leave') {
            isDragging = false;
          } else if (event.payload.type === 'drop') {
            isDragging = false;
            if (event.payload.paths && !isProcessing) {
              let added = false;
              for (const p of event.payload.paths) {
                if (!config.input_directories.includes(p)) {
                  config.input_directories = [...config.input_directories, p];
                  added = true;
                }
              }
              if (added && pipeline.status === 'done') {
                pipeline.status = 'idle';
              }
            }
          }
        });

        // Large-batch warning event.
        unlistenBatch = await listen<number>(EVENT_LARGE_BATCH_WARNING, (e) => {
          toast.warning(
            `⚠️ Large batch detected: ${e.payload} MKV files. This may take a while.`,
            0 // sticky
          );
        });
      } catch {
        /* not in Tauri context */
      }
    })();

    return () => {
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenBatch) unlistenBatch();
    };
  });

  $effect(() => {
    try {
      const appWindow = getCurrentWindow();
      if (isProcessing) {
        appWindow.setProgressBar({
          status: ProgressBarStatus.Normal,
          progress: Math.floor(pipelineProgress)
        });
      } else {
        appWindow.setProgressBar({
          status: ProgressBarStatus.None
        });
      }
    } catch {
      // Ignore errors when running outside Tauri
    }
  });

  $effect(() => {
    if (!configState.isLoaded) return;

    const deregister = [
      registerShortcut({
        id: 'addFolder',
        pattern: config.shortcuts.addFolder || 'Ctrl+o',
        action: addFolder
      }),
      registerShortcut({
        id: 'startConversion',
        pattern: config.shortcuts.startConversion || 'Ctrl+Enter',
        action: startProcessing
      }),
      registerShortcut({
        id: 'stopConversion',
        pattern: config.shortcuts.stopConversion || 'Escape',
        action: stopProcessing
      }),
      registerShortcut({
        id: 'resetQueue',
        pattern: config.shortcuts.resetQueue || 'Ctrl+r',
        action: () => {
          if (!isProcessing) {
            config.input_directories = [];
            resetPipeline();
          }
        }
      }),
      registerShortcut({
        id: 'openAbout',
        pattern: config.shortcuts.openAbout || 'F1',
        action: () => {
          showAbout = !showAbout;
        }
      })
    ];

    return () => {
      deregister.forEach((d) => d());
    };
  });

  // -------------------------------------------------------------------------
  // Processing
  // -------------------------------------------------------------------------

  async function startProcessing() {
    if (isProcessing) return;
    if (selectedFolders.length === 0) {
      toast.warning('Please add at least one folder to the queue.');
      return;
    }

    resetPipeline();
    pipeline.status = 'scanning';

    startPipelineTimer();

    const channel = new Channel<{ event: string; data: unknown }>();

    channel.onmessage = (payload) => {
      const { event, data } = payload;

      if (event === 'StartedScanned') {
        const payloadData = data as {
          total_count?: number;
          folder_counts?: Record<string, number>;
        };
        if (typeof data === 'number') {
          handleStartedScanned(data);
        } else if (payloadData && typeof payloadData.total_count === 'number') {
          handleStartedScanned(payloadData.total_count, payloadData.folder_counts);
        }
      } else if (event === 'FileProcessed') {
        const parsed = FileProcessedDataSchema.safeParse(data);
        if (parsed.success) {
          handleFileProcessed(
            parsed.data.processed,
            parsed.data.converted,
            parsed.data.root_directory
          );
        }
      } else if (event === 'FolderStatusUpdate') {
        const payloadData = data as { folder?: string; status?: string };
        if (payloadData && payloadData.folder && payloadData.status) {
          handleFolderStatusUpdate(payloadData.folder, payloadData.status);
        }
      } else if (event === 'Cancelled') {
        handleCancelled();
        toast.info('Processing was cancelled.');
      }
    };

    try {
      const rawSummary = await invoke(CMD_PROCESS_MKV_DIRECTORY, {
        paths: selectedFolders,
        recursive: config.recursive,
        concurrency: config.concurrency,
        onProgress: channel
      });

      if (rawSummary) {
        const parsed = FinishedDataSchema.safeParse(rawSummary);
        if (parsed.success) {
          handleFinished(parsed.data);
          onFinished();
        } else {
          toast.error('Finished payload failed validation! ' + String(parsed.error));
          handleFinished(rawSummary as import('$lib/types').FinishedData);
          onFinished();
        }
      } else {
        toast.error('Raw summary was empty/undefined!');
      }
    } catch (e) {
      toast.error(`Processing failed: ${e}`);
      pipeline.status = 'idle';
      stopPipelineTimer();
    }
  }

  async function stopProcessing() {
    if (!isProcessing) return;
    try {
      await invoke(CMD_ABORT_PROCESSING);
    } catch (e) {
      toast.error(`Failed to abort: ${e}`);
    }
  }

  async function onFinished() {
    const msg =
      pipeline.tracksConverted > 0
        ? `✅ Done! Converted ${pipeline.tracksConverted} track(s).`
        : `✅ Done. No subtitle tracks were converted.`;

    toast.success(msg);

    if (config.notifications) {
      try {
        await sendNotification({
          title: 'MKV Subtitle Converter',
          body: msg
        });
      } catch {
        /* notification permission not granted */
      }
    }
  }

  async function clearHistory() {
    try {
      await invoke(CMD_CLEAR_PROCESSING_HISTORY);
      toast.success('Processing history cleared. All files will be re-processed on the next run.');
    } catch (e) {
      toast.error(`Failed to clear history: ${e}`);
    } finally {
      showClearHistoryConfirm = false;
    }
  }
</script>

<svelte:head>
  <title>MKV Subtitle Extractor Converter</title>
  <meta name="description" content="Batch-convert embedded MKV subtitle tracks to ASS format" />
</svelte:head>

<main class="page">
  <!-- ===== HEADER ===== -->
  <header class="app-header">
    <div class="header-brand">
      <span class="header-icon" aria-hidden="true">🎬</span>
      <div>
        <h1 class="header-title">MKV Subtitle Extractor</h1>
        <p class="header-subtitle">Batch-convert embedded subtitle tracks to ASS format</p>
      </div>
    </div>

    <div class="header-actions">
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href="/guide" class="icon-btn" title="How To Use" aria-label="Open Guide">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </a>

      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href="/settings" class="icon-btn" title="Settings" aria-label="Settings">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          ></path>
        </svg>
      </a>

      <button
        class="icon-btn"
        onclick={() => (showClearHistoryConfirm = true)}
        disabled={isProcessing}
        title="Clear Processing History"
        aria-label="Clear processing history"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
        </svg>
      </button>

      <button
        class="icon-btn"
        onclick={() => (showAbout = true)}
        title="About (F1)"
        aria-label="Open About"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
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

  <!-- ===== FOLDER QUEUE ===== -->
  <div class="scrollable-content">
    <section class="section">
      <DirectoryQueue
        folders={selectedFolders}
        disabled={isProcessing}
        directoryStatuses={pipeline.directoryStatuses}
        folderCounts={pipeline.folderCounts}
        completedFilesPerDir={pipeline.completedFilesPerDir}
        {isDragging}
        onAdd={addFolder}
        onRemove={removeFolder}
        onClearAll={clearAllFolders}
        onReorder={reorderFolders}
      />
    </section>

    <!-- ===== ACTION BAR ===== -->
    <div class="action-bar">
      {#if isProcessing}
        <button
          class="btn btn-danger"
          onclick={(e) => {
            stopProcessing();
            e.currentTarget.blur();
          }}
          id="btn-stop"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stop (Esc)
        </button>
      {:else}
        <button
          class="btn btn-primary"
          onclick={(e) => {
            startProcessing();
            e.currentTarget.blur();
          }}
          disabled={selectedFolders.length === 0}
          id="btn-start"
          title="Start Conversion (Ctrl+Enter)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {pipeline.status === 'idle' ||
          pipeline.status === 'done' ||
          pipeline.status === 'cancelled'
            ? 'Start Conversion'
            : 'Processing…'}
        </button>
      {/if}
    </div>

    <!-- ===== METRICS ===== -->
    <section class="section">
      <MetricsPanel
        totalFiles={pipeline.totalFiles}
        filesProcessed={pipeline.filesProcessed}
        filesSucceeded={pipeline.filesSucceeded}
        filesFailed={pipeline.filesFailed}
        filesSkipped={pipeline.filesSkipped}
        filesNoTracks={pipeline.filesNoTracks}
        tracksConverted={pipeline.tracksConverted}
        progress={pipelineProgress}
        elapsedSeconds={pipeline.elapsedSeconds}
        elapsedMs={pipeline.elapsedMs}
        status={pipeline.status}
      />
    </section>

    <!-- ===== TERMINAL LOG ===== -->
    <section class="section terminal-section">
      <TerminalLog logs={pipeline.logs} maxHeight="280px" />
    </section>
  </div>
</main>

<!-- ===== MODALS ===== -->
{#if showAbout}
  <AboutModal onClose={() => (showAbout = false)} />
{/if}

{#if showClearHistoryConfirm}
  <ConfirmationModal
    title="Clear Processing History"
    message="This will delete all records of previously processed files. All files in your queue will be re-processed on the next run. This cannot be undone."
    confirmLabel="Clear History"
    dangerous={true}
    onConfirm={clearHistory}
    onCancel={() => (showClearHistoryConfirm = false)}
  />
{/if}

<style lang="scss">
  .page {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 20px 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100vh;
    overflow: hidden;
  }

  // ── Header ──────────────────────────────────────────────────────────
  .app-header {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-top: 8px;
    padding-right: 52px; // leave room for theme toggle button
    margin-bottom: 16px;
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-right: 8px; /* space for scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .header-icon {
    font-size: 2.2rem;
    line-height: 1;
  }

  .header-title {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-color) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
  }

  .header-subtitle {
    font-size: 0.78rem;
    color: var(--text-secondary);
    margin: 4px 0 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  // ── Sections ─────────────────────────────────────────────────────────

  .terminal-section {
    flex: 1;
  }

  // ── Settings strip removed ───────────────────────────────────────────────────

  // ── Report links removed ─────────────────────────────────────────────────────

  // ── Action bar ────────────────────────────────────────────────────────
  .action-bar {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 4px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    transition: all 0.18s;
    letter-spacing: 0.02em;

    svg {
      width: 16px;
      height: 16px;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    background: var(--accent-color);
    color: #fff;
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);

    &:hover:not(:disabled) {
      filter: brightness(1.1);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }

  .btn-danger {
    background: var(--danger-color);
    color: #fff;
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);

    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
      transform: translateY(-1px);
    }
  }

  // ── Icon buttons ─────────────────────────────────────────────────────
  .icon-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 7px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    transition: all 0.15s;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      background: var(--bg-hover-panel);
      border-color: var(--accent-color);
      color: var(--text-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
</style>
