<script lang="ts">
  import "../styles/app.scss";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { open, save } from "@tauri-apps/plugin-dialog";
  import { revealItemInDir } from "@tauri-apps/plugin-opener";

  let rootPath = $state("");
  let fileTypes = $state(".xml");
  let excludes = $state("*temp*, *backup*");
  let isDarkMode = $state(true);
  let result = $state<any>(null);
  let savedTo = $state("");
  let isSearching = $state(false);
  let isCancelled = $state(false);
  let validationError = $state("");

  let liveFilesFound = $state(0);
  let liveDirsScanned = $state(0);

  const darkInput  = "background-color:#2D2D2D;color:#e0e0e0;border-color:#4A4A4A;";
  const lightInput = "background-color:#ffffff;color:#222222;border-color:#cccccc;";
  const darkBtn    = "background-color:#2D2D2D;color:#e0e0e0;border-color:#4A4A4A;";
  const lightBtn   = "background-color:#ffffff;color:#222222;border-color:#cccccc;";

  let inputStyle = $derived(isDarkMode ? darkInput : lightInput);
  let btnStyle   = $derived(isDarkMode ? darkBtn   : lightBtn);

  function reapplyInputStyles() {
    const style = isDarkMode ? darkInput : lightInput;
    document.querySelectorAll<HTMLInputElement>("input").forEach(el => {
      el.setAttribute("style", style);
    });
  }

  function clearResults() {
    if (!isSearching) {
      result = null;
      savedTo = "";
      isCancelled = false;
      validationError = "";
      liveFilesFound = 0;
      liveDirsScanned = 0;
    }
  }

  function clearRootPath() {
    rootPath = "";
    clearResults();
  }

  function clearFileTypes() {
    fileTypes = "";
    clearResults();
  }

  function clearExcludes() {
    excludes = "";
    clearResults();
  }

  function applyTheme() {
    document.body.classList.toggle("dark", isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? "#121212" : "#ffffff";
  }

  onMount(async () => {
    applyTheme();
    await invoke("set_window_theme", { dark: isDarkMode });
    const unlisten = await listen("search-progress", (event: any) => {
      liveFilesFound = event.payload.files_found;
      liveDirsScanned = event.payload.dirs_scanned;
    });
    return () => unlisten();
  });

  async function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    await invoke("set_window_theme", { dark: isDarkMode });
    reapplyInputStyles();
  }

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      rootPath = selected as string;
      clearResults();
    }
  }

  async function stopSearch() {
    await invoke("cancel_search");
  }

  async function openFolder(targetPath: string) {
    try {
      await revealItemInDir(targetPath);
    } catch (e: any) {
      console.error("Failed to open folder:", e);
      validationError = "Could not open folder. Check your system's default file manager.";
    }
  }

  async function runSearch() {
    if (!rootPath) return;

    const components = rootPath.split(/[/\\]/).filter(Boolean);
    let rootName = components.pop() || components[0] || "export";
    rootName = rootName.replace(/[:\\/]/g, "");
    const now = new Date();
    const ts = now.toISOString().split('.')[0].replace(/:/g, "-").replace("T", "_");
    const defaultFilename = `${rootName}_${ts}.json`;

    const path = await save({
      title: "Select Save Destination",
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: defaultFilename
    });

    if (!path) return;

    isSearching = true;
    isCancelled = false;
    savedTo = "";
    result = null;
    validationError = "";
    liveFilesFound = 0;
    liveDirsScanned = 0;

    const types = fileTypes.split(",").map(s => s.trim());
    const excludeList = excludes.split(",").map(s => s.trim()).filter(s => s !== "");

    try {
      const metadata = await invoke<any>("search_files", {
        rootDir: rootPath.trim(),
        fileTypes: types,
        excludePatterns: excludeList,
        savePath: path
      });

      result = metadata;
      savedTo = path;
    } catch (e: any) {
      const errMsg = typeof e === 'string' ? e : (e?.message || JSON.stringify(e));

      if (errMsg === "Operation cancelled by user") {
        isCancelled = true;
        result = null;
      } else if (errMsg.includes("Path does not exist") || errMsg.includes("is not a directory")) {
        validationError = errMsg;
        result = null;
      } else {
        validationError = `System Error: ${errMsg}`;
        console.error("Critical Error:", e);
      }
    } finally {
      isSearching = false;
    }
  }
</script>

<main class="container">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1>FILE FINDER</h1>
    <button
      class="btn"
      onclick={toggleTheme}
      disabled={isSearching}
      style="font-size: 2rem; border: none; background: none; color: inherit;"
    >
      {isDarkMode ? "🌙" : "☀️"}
    </button>
  </div>

  <div class="field">
    <label for="root-path">ROOT SEARCH DIRECTORY</label>
    <div class="input-row">
      <div class="input-wrapper">
        <input
          id="root-path"
          bind:value={rootPath}
          oninput={() => { clearResults(); reapplyInputStyles(); }}
          onchange={reapplyInputStyles}
          disabled={isSearching}
          placeholder="Select or paste folder path..."
          autocomplete="off"
          style="{inputStyle}{validationError ? 'border-color:#ef4444;outline:1px solid #ef4444;' : ''}"
        />
        {#if rootPath && !isSearching}
          <button class="clear-btn" onclick={clearRootPath} style={btnStyle} title="Clear">✕</button>
        {/if}
      </div>
      <button
        class="btn"
        onclick={pickFolder}
        disabled={isSearching}
        style={btnStyle}
      >Browse</button>
    </div>
    {#if validationError}
      <span class="error-subtext">✕ {validationError}</span>
    {/if}
  </div>

  <div class="field">
    <label for="ext-input">EXTENSIONS</label>
    <div class="input-wrapper">
      <input
        id="ext-input"
        bind:value={fileTypes}
        oninput={() => { clearResults(); reapplyInputStyles(); }}
        onchange={reapplyInputStyles}
        disabled={isSearching}
        placeholder=".txt, .json"
        autocomplete="off"
        style={inputStyle}
      />
      {#if fileTypes && !isSearching}
        <button class="clear-btn" onclick={clearFileTypes} style={btnStyle} title="Clear">✕</button>
      {/if}
    </div>
  </div>

  <div class="field">
    <label for="exclude-input">EXCLUSION PATTERNS</label>
    <div class="input-wrapper">
      <input
        id="exclude-input"
        bind:value={excludes}
        oninput={() => { clearResults(); reapplyInputStyles(); }}
        onchange={reapplyInputStyles}
        disabled={isSearching}
        placeholder="*temp*, *backup*"
        autocomplete="off"
        style={inputStyle}
      />
      {#if excludes && !isSearching}
        <button class="clear-btn" onclick={clearExcludes} style={btnStyle} title="Clear">✕</button>
      {/if}
    </div>
  </div>

  <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
    <div style="display: flex; gap: 10px; width: 100%;">
      <button class="btn primary" onclick={runSearch} disabled={!rootPath || isSearching}>
        {#if isSearching}<span class="spinner"></span>{/if}
        {isSearching ? "SCANNING & WRITING..." : "GENERATE JSON"}
      </button>

      {#if isSearching}
        <button class="btn" onclick={stopSearch} style="border-color:#ef4444;color:#ef4444;width:auto;">
          STOP
        </button>
      {/if}
    </div>

    {#if isSearching}
      <div class="monitor-bar">
        <div class="progress-track">
          <div class="indeterminate-thumb"></div>
        </div>
        <div class="monitor-stats">
          <span class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Scanned: <strong>{liveDirsScanned}</strong>
          </span>
          <span class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Found: <strong>{liveFilesFound}</strong>
          </span>
        </div>
      </div>
    {/if}
  </div>

  {#if isCancelled || result || validationError}
    <div class="results-display">
      {#if isCancelled}
        <div style="padding: 12px; background: rgba(251, 191, 36, 0.15); border: 1px solid #fbbf24; border-radius: 6px;">
          <p class={isDarkMode ? "warning-text-dark" : "warning-text-light"} style="margin: 0;">
            🛑 <strong>Generation Stopped:</strong> The process was cancelled by the user.
          </p>
        </div>
      {:else if validationError}
        <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: 6px;">
          <p style="color: #ef4444; font-weight: 600; margin: 0; word-break: break-all;">
            🚫 <strong>{validationError}</strong>
          </p>
        </div>
      {:else if result}
        <div style="margin-bottom: 1rem;">
          <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Total Matching Files: <strong>{result.totalMatchingFiles}</strong>
          </p>
          <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Search Time: <strong>{result.executionTimeFormatted}</strong>
          </p>

          {#if result.totalMatchingFiles === 0}
            <p style="color: #ef4444; font-weight: 600; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; margin-top: 10px;">
              No matching files found. Metadata recorded.
            </p>
          {/if}
        </div>

        {#if savedTo}
          <div class="success-banner">
            <span class="success-text">✓ Streamed to: {savedTo}</span>
            <button
              class="btn secondary-action"
              onclick={() => openFolder(savedTo)}
              style={btnStyle}
            >
              📂 Open Folder
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</main>