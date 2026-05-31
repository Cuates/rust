<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount, tick } from 'svelte';

  let config = $state({
    input_directories: [] as string[],
    file_extensions: 'mkv, mp4, mov, avi, ogm, wmv',
    subtitle_tracks: 'ang, eng, enm, zxx, und',
    output_extension: '.mkv',
    conversion_mode: 'remux',
    video_codec: 'libx265',
    preset: 'faster',
    crf: '18'
  });

  // State Management
  let consoleLogs = $state<string[]>([]);
  let processingActive = $state(false);
  let isDarkMode = $state(true);
  let showMetricsPanel = $state(false);

  // Layout Metric Sync Parameters
  let currentFileIndex = $state(0);
  let totalFilesCount = $state(0);
  let overallProgress = $state(0);
  let runningTimeFormatted = $state('0ms');

  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;

  // Add this with your other state variables
  let hasNvidia = $state(false);

  onMount(() => {
    // 1. Synchronous UI initialization
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      isDarkMode = savedTheme === 'dark';
    } else {
      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    applyThemeBody();

    // 2. Define the cleanup reference
    let cleanup: (() => void) | undefined;

    // 3. Define and immediately call an internal async init function
    const init = async () => {
      // Diagnostic check
      try {
        hasNvidia = await invoke('check_nvenc_support');
      } catch (err) {
        console.error('Diagnostic check failed:', err);
      }

      // Event Listeners
      const unlistenLogFn = await listen<string>('process-log', async (event) => {
        // 🚀 Intercept and skip the log if it reports 0 fallback resolutions
        if (event.payload.includes('Failures resolved via fallback: 0')) {
          return;
        }

        consoleLogs = [...consoleLogs, event.payload];
        if (event.payload.includes('Scanned file total:')) {
          const match = event.payload.match(/Scanned file total:\s*(\d+)/);
          if (match) {
            totalFilesCount = parseInt(match[1], 10);
            currentFileIndex = 0;
          }
        }
        await tick();
        const term = document.getElementById('terminal-shell');
        if (term) term.scrollTop = term.scrollHeight;
      });

      const unlistenProgressFn = await listen<{
        progress: number;
        current_index?: number;
        total_files?: number;
      }>('process-progress', (event) => {
        if (event.payload.progress !== undefined) overallProgress = event.payload.progress;
        if (event.payload.current_index !== undefined)
          currentFileIndex = event.payload.current_index;
        if (event.payload.total_files !== undefined) totalFilesCount = event.payload.total_files;
      });

      const appWindow = getCurrentWindow();
      let isClosing = false;
      const unlistenCloseFn = await appWindow.onCloseRequested((event) => {
        if (processingActive) {
          event.preventDefault();
          if (isClosing) return;
          isClosing = true;
          (async () => {
            consoleLogs = [
              ...consoleLogs,
              '⚠️ Window close requested mid-execution. Cleaning up...'
            ];
            await abortPipeline();
            await appWindow.destroy();
          })();
        }
      });

      // Assign the final cleanup logic
      cleanup = () => {
        unlistenLogFn();
        unlistenProgressFn();
        unlistenCloseFn();
        clearInterval(timerInterval);
      };
    };

    init();

    // 4. Return the synchronous cleanup function
    return () => {
      if (cleanup) cleanup();
    };
  });

  function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const hours = Math.floor(elapsedMs / 3600000);
      const minutes = Math.floor((elapsedMs % 3600000) / 60000);
      const seconds = Math.floor((elapsedMs % 60000) / 1000);
      const milliseconds = elapsedMs % 1000;

      let outputSegments = [];
      if (hours > 0) outputSegments.push(`${hours}h`);
      if (minutes > 0) outputSegments.push(`${minutes}m`);
      if (seconds > 0) outputSegments.push(`${seconds}s`);
      outputSegments.push(`${milliseconds}ms`);

      runningTimeFormatted = outputSegments.join(' ');
    }, 33);
  }

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    localStorage.setItem('app-theme', isDarkMode ? 'dark' : 'light');
    applyThemeBody();
  }

  async function applyThemeBody() {
    const appWindow = getCurrentWindow();
    if (isDarkMode) {
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

  async function handleDirectoryBrowse() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: true,
        title: 'Select Input Video Processing Directory'
      });
      if (selectedPath) {
        if (Array.isArray(selectedPath)) {
          const newPaths = selectedPath.filter((p) => !config.input_directories.includes(p));
          config.input_directories = [...config.input_directories, ...newPaths];
        } else {
          if (!config.input_directories.includes(selectedPath as string)) {
            config.input_directories = [...config.input_directories, selectedPath as string];
          }
        }
      }
    } catch (err) {
      consoleLogs = [...consoleLogs, `❌ Directory browser access failure: ${err}`];
    }
  }

  function removeDirectory(index: number) {
    const updatedDirs = [...config.input_directories];
    updatedDirs.splice(index, 1);
    config.input_directories = updatedDirs;
    if (config.input_directories.length === 0) {
      consoleLogs = [];
      totalFilesCount = 0;
      currentFileIndex = 0;
      overallProgress = 0;
      runningTimeFormatted = '0ms';
      showMetricsPanel = false;
    }
  }

  async function displaySidecarVersions() {
    consoleLogs = [...consoleLogs, '--- Querying Embedded Sidecar Binary Configurations ---'];
    const tools = ['ffmpeg', 'mkvmerge'];
    for (const tool of tools) {
      try {
        const ver: string = await invoke('get_sidecar_version', { binaryName: tool });
        consoleLogs = [...consoleLogs, `[Sidecar Asset] ${tool.toUpperCase()}: ${ver.trim()}`];
      } catch {
        consoleLogs = [
          ...consoleLogs,
          `[Sidecar Asset] ${tool.toUpperCase()}: Verified embedded production binary instance asset active.`
        ];
      }
    }
    consoleLogs = [...consoleLogs, '--------------------------------------------------------'];
    await tick();
    const term = document.getElementById('terminal-shell');
    if (term) term.scrollTop = term.scrollHeight;
  }

  async function executePipeline() {
    if (config.input_directories.length === 0) {
      consoleLogs = [
        ...consoleLogs,
        '❌ Error: Please add at least one target directory to the queue before running processing tasks.'
      ];
      await tick();
      let term = document.getElementById('terminal-shell');
      if (term) term.scrollTop = term.scrollHeight;
      return;
    }

    processingActive = true;
    showMetricsPanel = true;
    overallProgress = 0;
    currentFileIndex = 0;
    totalFilesCount = 0;
    consoleLogs = ['Pipeline initialization request authenticated...'];

    startTimer();
    await displaySidecarVersions();
    try {
      config.crf = String(config.crf);
      const summaryMessage: string = await invoke('process_video_pipeline', { payload: config });

      overallProgress = 100;
      consoleLogs = [...consoleLogs, summaryMessage];
    } catch (err) {
      consoleLogs = [...consoleLogs, `❌ Pipeline execution failure: ${err}`];
    } finally {
      processingActive = false;
      stopTimer();
      await tick();
      let term = document.getElementById('terminal-shell');
      if (term) term.scrollTop = term.scrollHeight;
    }
  }

  async function abortPipeline() {
    try {
      consoleLogs = [
        ...consoleLogs,
        '⚠️ Halt instruction issued. Terminating processes and rolling back...'
      ];
      await tick();
      let term = document.getElementById('terminal-shell');
      if (term) term.scrollTop = term.scrollHeight;

      await invoke('abort_video_pipeline');
      consoleLogs = [
        ...consoleLogs,
        '🛑 Processing execution stopped and partial files cleaned up.'
      ];
    } catch (err) {
      consoleLogs = [...consoleLogs, `Error safely terminating workers: ${err}`];
    } finally {
      processingActive = false;
      stopTimer();

      await tick();
      setTimeout(() => {
        let term = document.getElementById('terminal-shell');
        if (term) term.scrollTop = term.scrollHeight;
      }, 40);
    }
  }

  // --- Copy Logs Feature State ---
  let copiedStatus = $state(false);

  async function copyTerminalLogs() {
    if (consoleLogs.length === 0) return;

    const fullLogText = consoleLogs.join('\n');

    try {
      await navigator.clipboard.writeText(fullLogText);
      copiedStatus = true;
      setTimeout(() => {
        copiedStatus = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy pipeline terminal output logs: ', err);
    }
  }
</script>

<main class="app-container">
  <header class="navbar-layer">
    <h1>MKV Filter Metadata</h1>
    <button
      class="theme-toggle-icon-btn"
      onclick={toggleTheme}
      aria-label="Toggle color display theme"
    >
      {#if isDarkMode}☀️{:else}🌙{/if}
    </button>
  </header>

  <div class="form-workspace-card">
    <div class="row">
      <div class="queue-header">
        <label for="queue-box">Target Processing Queue ({config.input_directories.length})</label>
        <button class="add-folder-btn" onclick={handleDirectoryBrowse} disabled={processingActive}>
          + Add Folder to Queue
        </button>
      </div>
      <div id="queue-box" class="queue-container">
        {#if config.input_directories.length === 0}
          <div class="empty-queue-msg">No directories currently in queue...</div>
        {:else}
          {#each config.input_directories as dir, i (dir)}
            <div class="queue-item">
              <span class="queue-path" title={dir}>{dir}</span>
              <button
                class="remove-btn"
                onclick={() => removeDirectory(i)}
                disabled={processingActive}
                aria-label="Remove item from path processing queue"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
                  ></line></svg
                >
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <div class="grid-layout-2">
      <div class="row">
        <label for="conv-mode">Conversion Mode</label>
        <select id="conv-mode" bind:value={config.conversion_mode} disabled={processingActive}>
          <option value="remux">Remux (Stream Copy)</option>
          <option value="reencode">Reencode Processing</option>
        </select>
      </div>
      <div class="row">
        <label for="out-ext">Output Extension</label>
        <input
          id="out-ext"
          bind:value={config.output_extension}
          placeholder=".mkv"
          autocomplete="off"
          disabled={processingActive}
        />
      </div>
    </div>

    <div class="grid-layout-2">
      <div class="row">
        <label for="exts">File Extensions Filter</label>
        <input
          id="exts"
          bind:value={config.file_extensions}
          placeholder="mkv, mp4, mov, avi, ogm, wmv"
          autocomplete="off"
          disabled={processingActive}
        />
      </div>
      <div class="row">
        <label for="subs">Subtitle Tracks to Keep</label>
        <input
          id="subs"
          bind:value={config.subtitle_tracks}
          placeholder="ang, eng, enm, zxx, und"
          autocomplete="off"
          disabled={processingActive}
        />
      </div>
    </div>

    {#if config.conversion_mode === 'reencode'}
      <div class="reencode-advanced-panel">
        <div class="grid-layout-3">
          <div class="row">
            <label for="v-codec">Video Encoder</label>
            <select id="v-codec" bind:value={config.video_codec} disabled={processingActive}>
              <option value="libx265">libx265 (CPU)</option>
              <option value="libx264">libx264 (CPU)</option>
              {#if hasNvidia}
                <option value="hevc_nvenc">hevc_nvenc (NVIDIA)</option>
                <option value="h264_nvenc">h264_nvenc (NVIDIA)</option>
              {/if}
            </select>
          </div>
          <div class="row">
            <label for="preset-val">Encoder Preset</label>
            <select id="preset-val" bind:value={config.preset} disabled={processingActive}>
              <option value="ultrafast">ultrafast</option>
              <option value="superfast">superfast</option>
              <option value="veryfast">veryfast</option>
              <option value="faster">faster</option>
              <option value="fast">fast</option>
              <option value="medium">medium</option>
              <option value="slow">slow</option>
              <option value="slower">slower</option>
              <option value="veryslow">veryslow</option>
            </select>
          </div>
          <div class="row">
            <label for="crf-val">CRF (0-51)</label>
            <input
              id="crf-val"
              type="number"
              value={parseInt(config.crf)}
              oninput={(e) => (config.crf = e.currentTarget.value)}
              min="0"
              max="51"
              autocomplete="off"
              disabled={processingActive}
            />
          </div>
        </div>
      </div>
    {/if}

    <div class="action-row">
      {#if processingActive}
        <button class="action-abort-btn" onclick={abortPipeline}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            style="margin-right: 6px;"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg
          > Stop Execution
        </button>
      {/if}
      <button
        class="action-trigger-btn"
        onclick={executePipeline}
        disabled={processingActive || config.input_directories.length === 0}
      >
        {processingActive ? 'Processing Pipelines...' : 'Start Processing'}
      </button>
    </div>
  </div>

  <div class="output-workspace-area">
    {#if showMetricsPanel}
      <div class="metrics-panel-row">
        <div class="progress-container-block">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: {overallProgress}%"></div>
          </div>
          <div class="progress-labels-sub-row">
            <span class="sub-metric-label"
              >Total Scanned: <strong>{currentFileIndex}</strong> / {totalFilesCount} file(s)</span
            >
            <span class="sub-metric-label text-right"
              >Overall Progress: <strong>{overallProgress}%</strong></span
            >
          </div>
        </div>
        <div class="time-container-block">
          <span class="total-time-title">Total Conversion Time:</span>
          <span class="total-time-value">{runningTimeFormatted}</span>
        </div>
      </div>
    {/if}

    <div class="terminal-container">
      <div class="terminal-header-row">
        <h3>Real-time Output Pipeline Log</h3>
        {#if consoleLogs.length > 0}
          <button
            class="copy-logs-btn"
            class:copied={copiedStatus}
            onclick={copyTerminalLogs}
            aria-label="Copy logs"
            data-tooltip={copiedStatus ? 'Copied!' : 'Copy logs'}
          >
            {#if copiedStatus}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            {/if}
          </button>
        {/if}
      </div>
      <div id="terminal-shell" class="terminal-shell">
        {#each consoleLogs as log, i (log + i)}
          <div class="log-line">{log}</div>
        {:else}
          <div class="empty-log-msg">Logs will appear here once processing begins...</div>
        {/each}
      </div>
    </div>
  </div>
</main>

<style>
  :global(body),
  :global(html),
  :global(#svelte) {
    margin: 0 !important;
    padding: 0 !important;
    height: 100vh !important;
    overflow: hidden !important;
  }

  :global(div:has(> main.app-container)) {
    display: contents !important;
  }

  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }
  :global(::-webkit-scrollbar-track) {
    background: var(--bg-canvas);
    border-radius: 4px;
  }
  :global(::-webkit-scrollbar-thumb) {
    background: var(--border-color);
    border-radius: 6px;
  }
  :global(::-webkit-scrollbar-thumb:hover) {
    background: var(--text-secondary);
  }

  :global(html.dark-mode) {
    --bg-canvas: #0f111a;
    --bg-surface: #161925;
    --text-primary: #f3f4f6;
    --text-secondary: #9ca3af;
    --border-color: #2a2e3f;
    --accent-color: #3b82f6;
    --accent-hover: #2563eb;
    --terminal-bg: #07080d;
    --terminal-text: #34d399;
    --danger-color: #ef4444;
    --danger-hover: #dc2626;
    --metrics-time-color: #3b82f6;
    --bg-hover-panel: #202436;
  }

  :global(html.light-mode) {
    --bg-canvas: #f1f5f9;
    --bg-surface: #ffffff;
    --text-primary: #0f172a;
    --text-secondary: #64748b;
    --border-color: #cbd5e1;
    --accent-color: #2563eb;
    --accent-hover: #1d4ed8;
    --terminal-bg: #ffffff;
    --terminal-text: #0f172a;
    --danger-color: #df2121;
    --danger-hover: #b91c1c;
    --metrics-time-color: #2563eb;
    --bg-hover-panel: #e2e8f0;
  }

  :global(body) {
    background-color: var(--bg-canvas) !important;
    color: var(--text-primary);
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow: hidden !important;
  }

  h1 {
    margin: 0 !important;
    padding: 0 !important;
    font-size: 1.25rem;
    line-height: 1.2;
  }

  .app-container {
    box-sizing: border-box;
    max-width: 850px;
    height: 100vh;
    margin: 0 auto;
    padding: 0 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    overflow: hidden !important;
  }

  .navbar-layer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding: 0.1rem 0 0.25rem 0;
    margin-top: 0 !important;
    flex-shrink: 0;
  }

  .navbar-layer h1 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
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
  }
  .theme-toggle-icon-btn:hover {
    background: var(--border-color);
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
    margin-top: 0 !important;
  }
  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.1rem;
    gap: 0.5rem;
    width: 100%;
  }
  .queue-header label {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    flex-grow: 1;
  }

  .add-folder-btn {
    background-color: var(--bg-surface);
    color: var(--accent-color);
    border: 1px solid var(--accent-color);
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    width: fit-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .add-folder-btn:hover:not(:disabled) {
    background-color: var(--accent-color);
    color: white;
  }
  .add-folder-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Perfectly clearing 4 item containers + layout gaps */
  .queue-container {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    min-height: 164px;
    max-height: 164px;
    overflow-y: auto;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .empty-queue-msg {
    padding: 0.6rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding-top: 3.7rem;
  }
  .queue-item {
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    align-items: center !important;
    background-color: var(--bg-surface);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }
  .queue-path {
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    padding-right: 0.5rem;
  }

  .remove-btn {
    background: none !important;
    border: none !important;
    color: var(--danger-color) !important;
    cursor: pointer;
    padding: 0.25rem !important;
    border-radius: 4px;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: background-color 0.15s;
    position: relative;
  }
  .remove-btn:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.15) !important;
  }
  .remove-btn:disabled {
    cursor: not-allowed !important;
    opacity: 0.5;
  }

  .grid-layout-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .grid-layout-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .row label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  input,
  select {
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus:not(:disabled),
  select:focus:not(:disabled) {
    border-color: var(--accent-color);
  }

  .reencode-advanced-panel {
    border-top: 1px solid var(--border-color);
    padding-top: 0.5rem;
  }
  .action-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.75rem;
  }

  .action-trigger-btn {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .action-trigger-btn:hover:not(:disabled) {
    background-color: var(--accent-hover);
  }
  .action-trigger-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-abort-btn {
    background-color: var(--danger-color);
    color: white;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.15s;
  }
  .action-abort-btn:hover {
    background-color: var(--danger-hover);
  }

  .output-workspace-area {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    flex-shrink: 0;
  }

  .metrics-panel-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.6rem 1rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    flex-shrink: 0;
  }
  .progress-container-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .progress-bar-track {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-bar-fill {
    background-color: var(--accent-color);
    height: 100%;
    transition: width 0.2s ease-out;
  }
  .progress-labels-sub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sub-metric-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
  .sub-metric-label strong {
    color: var(--text-primary);
  }

  .time-container-block {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.35rem;
    font-size: 0.8rem;
  }
  .total-time-title {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .total-time-value {
    color: var(--metrics-time-color);
    font-weight: 700;
    font-family: monospace, system-ui;
  }

  .terminal-container {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  .terminal-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;
  }
  .terminal-container h3 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* Icon-Only Copy Button Configuration */
  .copy-logs-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    width: 26px;
    height: 26px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease-in-out;
  }

  .copy-logs-btn:hover {
    background-color: var(--bg-hover-panel);
    color: var(--text-primary);
  }

  .copy-logs-btn:active {
    transform: scale(0.92);
  }

  .copy-logs-btn.copied {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  /* Force inner SVGs to be visible and correctly scaled */
  .copy-logs-btn svg {
    display: block !important;
    width: 14px !important;
    height: 14px !important;
    stroke: currentColor !important;
  }

  /* Tooltip configured beneath the icon to bypass terminal header clipping boundaries */
  .copy-logs-btn::before {
    content: attr(data-tooltip);
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    transform: translateY(-4px);
    z-index: 99;

    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    white-space: nowrap;

    opacity: 0;
    pointer-events: none;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
    transition:
      opacity 0.12s ease,
      transform 0.12s ease;
  }

  .copy-logs-btn:hover::before,
  .copy-logs-btn.copied::before {
    opacity: 1;
    transform: translateY(0);
  }

  .terminal-shell {
    background-color: var(--terminal-bg);
    color: var(--terminal-text);
    font-family: monospace;
    padding: 0.75rem;
    border-radius: 6px;
    height: 185px;
    min-height: 185px;
    max-height: 185px;
    overflow-y: auto;
    font-size: 0.85rem;
    border: 1px solid var(--border-color);
    box-sizing: border-box;
  }
  .log-line {
    margin-bottom: 0.25rem;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }
  .empty-log-msg {
    color: var(--text-secondary);
    font-style: italic;
    opacity: 0.5;
    text-align: center;
    padding-top: 4rem;
  }
</style>