<script lang="ts">
  import { invoke, Channel } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';

  // State Management
  let selectedFolders = $state<string[]>([]);
  let isProcessing = $state(false);
  let isStopping = $state(false);
  let logs = $state<string[]>([]);

  let terminalElement = $state<HTMLElement | null>(null);

  let startTime = $state<number | null>(null);
  let tickerInterval: any = null;

  // Progress & Metrics State
  let totalFiles = $state(0);
  let processedFiles = $state(0);
  let targetConvertedCount = $state(0);
  let convertedCount = $state(0);
  let elapsedSeconds = $state(0);
  let elapsedMilliseconds = $state(0);

  let folderReports = $state<Record<string, { hasSuccess: boolean; hasFailure: boolean }>>({});
  let progressPercent = $derived(totalFiles > 0 ? (processedFiles / totalFiles) * 100 : 0);

  let humanReadableTime = $derived.by(() => {
    if (elapsedSeconds === 0 && elapsedMilliseconds === 0) return '0s';
    let segments = [];
    if (elapsedSeconds >= 60) {
      const mins = Math.floor(elapsedSeconds / 60);
      const secs = elapsedSeconds % 60;
      segments.push(`${mins}m`);
      if (secs > 0) segments.push(`${secs}s`);
    } else if (elapsedSeconds > 0) {
      segments.push(`${elapsedSeconds}s`);
    }
    if (elapsedMilliseconds > 0) {
      segments.push(`${elapsedMilliseconds}ms`);
    }
    return segments.join(' ');
  });

  $effect(() => {
    if (convertedCount < targetConvertedCount) {
      const timer = setTimeout(() => {
        convertedCount += 1;
      }, 50);
      return () => clearTimeout(timer);
    }
  });

  $effect(() => {
    if (logs.length && terminalElement) {
      terminalElement.scrollTop = terminalElement.scrollHeight;
    }
  });

  function buildPath(baseFolderPath: string, fileName: string): string {
    const isWindows = baseFolderPath.includes('\\');
    const separator = isWindows ? '\\' : '/';
    return baseFolderPath.endsWith(separator)
      ? `${baseFolderPath}${fileName}`
      : `${baseFolderPath}${separator}${fileName}`;
  }

  async function verifyGeneratedReports() {
    if (selectedFolders.length === 0) return;
    try {
      const result = await invoke<Record<string, { hasSuccess: boolean; hasFailure: boolean }>>(
        'check_folder_reports',
        { paths: selectedFolders }
      );
      folderReports = result;
    } catch (err) {
      logs = [...logs, `⚠️ Failed to execute native backend folder report check: ${err}`];
    }
  }

  async function addDirectoryToQueue() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === 'string') {
      if (!selectedFolders.includes(selected)) {
        selectedFolders = [...selectedFolders, selected];
        await verifyGeneratedReports();
      }
    }
  }

  function removeDirectoryFromQueue(indexToRemove: number) {
    const folderToRemove = selectedFolders[indexToRemove];
    selectedFolders = selectedFolders.filter((_, index) => index !== indexToRemove);

    if (folderReports[folderToRemove]) {
      const copy = { ...folderReports };
      delete copy[folderToRemove];
      folderReports = copy;
    }

    if (selectedFolders.length === 0) {
      stopProgressTicker();
      resetState();
    }
  }

  function resetState(keepFolderReports = false, keepLogs = false, keepMetrics = false) {
    if (!keepLogs) {
      logs = [];
    }

    if (!keepMetrics) {
      totalFiles = 0;
      processedFiles = 0;
      targetConvertedCount = 0;
      convertedCount = 0;
      elapsedSeconds = 0;
      elapsedMilliseconds = 0;
    }

    isProcessing = false;
    isStopping = false;

    if (!keepFolderReports) {
      folderReports = {};
    }
  }

  function startProgressTicker() {
    startTime = performance.now();
    tickerInterval = setInterval(() => {
      if (startTime) {
        const durationMs = performance.now() - startTime;
        elapsedSeconds = Math.floor(durationMs / 1000);
        elapsedMilliseconds = Math.round(durationMs % 1000);
      }
    }, 100);
  }

  function stopProgressTicker() {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
    if (startTime) {
      const durationMs = performance.now() - startTime;
      elapsedSeconds = Math.floor(durationMs / 1000);
      elapsedMilliseconds = Math.round(durationMs % 1000);
    }
  }

  async function runConversion() {
    if (selectedFolders.length === 0) return;
    resetState(true); // --- FIX: Keep existing folder reports visible until refreshed ---

    startProgressTicker();
    isProcessing = true;
    logs = [...logs, `Initializing batch pipeline for ${selectedFolders.length} target directories.`];

    const onProgressChannel = new Channel<any>();
    onProgressChannel.onmessage = (message) => {
      switch (message.event) {
        case 'StartedScanned':
          totalFiles = message.data;
          logs = [...logs, `Analysis complete: Found a total of ${totalFiles} MKV file(s) across all folders.`];
          break;
        case 'FileProcessed':
          processedFiles = message.data.processed;
          targetConvertedCount = message.data.converted;
          break;
        case 'LogMessage':
          logs = [...logs, message.data];
          break;
        case 'Finished':
          stopProgressTicker();
          // --- FIX: Safely parse inner data attributes returned from backend maps ---
          logs = [...logs, `Pipeline finished safely. Total elapsed processing runtime: ${humanReadableTime}`];
          isProcessing = false;
          isStopping = false;
          startTime = null;
          setTimeout(() => { verifyGeneratedReports(); }, 200);
          break;
        case 'Cancelled':
          stopProgressTicker();
          logs = [...logs, `🛑 Processing aborted. Subtitles and session JSON registries have been cleared from the target folders.`];
          resetState(true, true, true);
          startTime = null;
          setTimeout(() => { verifyGeneratedReports(); }, 200);
          break;
        case 'Error':
          stopProgressTicker();
          logs = [...logs, `Critical Error encountered: ${message.data}`];
          isProcessing = false;
          isStopping = false;
          startTime = null;
          break;
      }
    };

    try {
      await invoke('process_mkv_directory', { paths: selectedFolders, onProgress: onProgressChannel });
    } catch (err) {
      stopProgressTicker();
      logs = [...logs, `Critical Framework Error: ${err}`];
      isProcessing = false;
      isStopping = false;
      startTime = null;
    }
  }

  async function triggerEarlyTermination() {
    if (isStopping) return;
    isStopping = true;
    logs = [...logs, `Attempting to send clean kill signal...`];

    try {
      await invoke('abort_mkv_directory_processing');
    } catch (err) {
      logs = [...logs, `Failed to cleanly send kill signal: ${err}`];
      isStopping = false;
    }
  }

  async function revealTargetJsonReport(baseFolderPath: string, reportFileName: 'converted_files.json' | 'failed_files.json') {
    if (!baseFolderPath) return;
    const structuralReportPath = buildPath(baseFolderPath, reportFileName);
    try {
      await invoke('show_item_in_folder', { path: structuralReportPath });
    } catch (err) {
      logs = [...logs, `Failed to highlight item in explorer window layout: ${err}`];
    }
  }
</script>

<main class="container">
  <h1>MKV Subtitle Extract Converter</h1>

  <div class="card">
    <button class="btn" onclick={addDirectoryToQueue} disabled={isProcessing}>
      ➕ Add Folder to Queue
    </button>

    <div class="queue-container">
      <h3>Target Processing Queue ({selectedFolders.length})</h3>
      {#if selectedFolders.length === 0}
        <p class="empty-queue-msg">No folders selected. Add target folders above to begin multi-batch execution.</p>
      {:else}
        <ul class="queue-list">
          {#each selectedFolders as folder, i}
            <li class="queue-item" title={folder}>
              <div class="queue-item-left">
                <code class="folder-path-text">{folder}</code>
              </div>
              <div class="queue-item-actions">
                {#if folderReports[folder]?.hasSuccess}
                  <button
                    class="btn btn-secondary btn-inline-open success-action-btn"
                    onclick={() => revealTargetJsonReport(folder, 'converted_files.json')}
                    title="Reveal converted_files.json in explorer"
                  >
                    📁 Converted
                  </button>
                {/if}

                {#if folderReports[folder]?.hasFailure}
                  <button
                    class="btn btn-secondary btn-inline-open failure-action-btn"
                    onclick={() => revealTargetJsonReport(folder, 'failed_files.json')}
                    title="Reveal failed_files.json in explorer"
                  >
                    📁 Failed
                  </button>
                {/if}

                <button
                  class="btn-remove"
                  onclick={() => removeDirectoryFromQueue(i)}
                  disabled={isProcessing}
                  title="Remove folder from queue"
                >
                  ✕
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if selectedFolders.length > 0}
      <div class="action-row">
        <button class="btn processing-btn" onclick={runConversion} disabled={isProcessing}>
          {#if isProcessing}
            <div class="spinner"></div>
            <span>PROCESSING QUEUE...</span>
          {:else}
            <span>Start Multi-Folder Conversion</span>
          {/if}
        </button>

        {#if isProcessing}
          <button
            class="btn tactile-stop-btn"
            class:stopping-active={isStopping}
            onclick={triggerEarlyTermination}
            disabled={isStopping}
          >
            {isStopping ? 'STOPPING...' : 'STOP'}
          </button>
        {/if}
      </div>
    {/if}

    {#if selectedFolders.length > 0 && (isProcessing || totalFiles > 0)}
      <div class="progress-container">
        <div class="progress-bar" style="width: {progressPercent}%"></div>
      </div>
      <div class="progress-meta">
        <div>Total Scanned: <b>{processedFiles}</b> / {totalFiles} file(s)</div>
        <div>Overall Progress: <b>{Math.round(progressPercent)}%</b></div>
      </div>
    {/if}
  </div>

  {#if selectedFolders.length > 0 && (totalFiles > 0 || elapsedSeconds > 0 || elapsedMilliseconds > 0)}
    <div class="metrics-grid">
      <div class="metric-box">Total Converted Files: <span>{convertedCount}</span></div>
      <div class="metric-box">Total Conversion Time: <span>{humanReadableTime}</span></div>
    </div>
  {/if}

  {#if selectedFolders.length > 0 && logs.length > 0}
    <div class="card terminal-logger-box" bind:this={terminalElement}>
      {#each logs as log}
        <div class="terminal-line">📡 {log}</div>
      {/each}
    </div>
  {/if}
</main>

<style lang="scss">
  :global(html, body) { margin: 0 !important; padding: 0 !important; overflow: hidden !important; height: 100%; width: 100%; background-color: var(--bg-color); }
  .container { max-width: 860px; margin: 0 auto; padding: 0.5rem 1rem 1rem 1rem; box-sizing: border-box; display: flex; flex-direction: column; gap: 0.5rem; max-height: 100vh; justify-content: flex-start; }
  h1 { margin: 0.25rem 0 0.5rem 0 !important; font-size: 1.85rem; }
  .card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem; }
  .queue-container { margin-top: 0.5rem; background: rgba(128, 128, 128, 0.04); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; }
  .queue-container h3 { margin: 0 0 0.5rem 0; font-size: 0.95rem; opacity: 0.9; }
  .empty-queue-msg { margin: 0; font-size: 0.85rem; color: #8e8e93; font-style: italic; }
  .queue-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; max-height: 200px; overflow-y: auto; padding-right: 12px; }
  .queue-item { display: flex; justify-content: space-between; align-items: center; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.35rem 0.65rem; gap: 1rem; }
  .queue-item-left { flex: 1; min-width: 0; }
  .queue-item-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
  .btn-inline-open { padding: 0.2rem 0.45rem !important; font-size: 0.8rem !important; font-weight: 500 !important; &.success-action-btn { color: #34c759; border-color: rgba(52, 199, 89, 0.3); &:hover { background-color: rgba(52, 199, 89, 0.1); } } &.failure-action-btn { color: #ff3b30; border-color: rgba(255, 59, 48, 0.3); &:hover { background-color: rgba(255, 59, 48, 0.1); } } }
  .folder-path-text { font-family: 'Consolas', 'Courier New', monospace; font-size: 0.85rem; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .btn-remove { background: transparent; color: #ff3b30; border: none; padding: 0.2rem 0.5rem; font-size: 0.9rem; cursor: pointer; font-weight: bold; border-radius: 4px; transition: background 0.2s; &:hover:not(:disabled) { background: rgba(255, 59, 48, 0.1); } &:disabled { opacity: 0.3; cursor: not-allowed; } }
  .action-row { display: flex; gap: 1rem; margin-top: 0.75rem; }
  .progress-container { margin-top: 0.75rem; background: var(--border-color); border-radius: 4px; height: 8px; overflow: hidden; }
  .progress-bar { background: var(--accent-color); height: 100%; transition: width 0.2s ease; }
  .progress-meta { display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 0.4rem; opacity: 0.8; }
  .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.25rem; }
  .metric-box { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.6rem 0.85rem; font-size: 0.9rem; color: var(--text-color); span { font-weight: bold; color: var(--accent-color); } }
  .terminal-logger-box { background-color: var(--terminal-bg); color: var(--terminal-text); font-family: 'Consolas', monospace; border: 1px solid var(--border-color); max-height: 120px; overflow-y: auto; word-break: break-all; padding: 0.5rem; margin-top: 0.25rem; border-radius: 6px; box-sizing: border-box; }
  .terminal-line { margin-bottom: 0.2rem; font-size: 0.85rem; }
  .btn.processing-btn:disabled { background-color: var(--border-color); color: #8e8e93; opacity: 0.8; }

  .btn.tactile-stop-btn {
    background-color: transparent;
    color: #ff453a;
    border: 1px solid rgba(255, 69, 58, 0.4);
    border-radius: 6px;
    font-weight: 600;
    letter-spacing: 0.02em;
    padding: 0.5rem 1.25rem;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover:not(:disabled) {
      background-color: rgba(255, 69, 58, 0.1);
      border-color: #ff453a;
    }

    &.stopping-active {
      background-color: rgba(255, 69, 58, 0.15) !important;
      color: #ff453a !important;
      border-color: rgba(255, 69, 58, 0.6) !important;
      animation: pulse-text-opacity 1.5s infinite ease-in-out;
      cursor: not-allowed;
    }
  }

  @keyframes pulse-text-opacity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .queue-list::-webkit-scrollbar, .terminal-logger-box::-webkit-scrollbar { width: 6px; }
  .queue-list::-webkit-scrollbar-track, .terminal-logger-box::-webkit-scrollbar-track { background: transparent; }
  .queue-list::-webkit-scrollbar-thumb, .terminal-logger-box::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
  .queue-list::-webkit-scrollbar-thumb:hover, .terminal-logger-box::-webkit-scrollbar-thumb:hover { background: var(--accent-color); }
</style>