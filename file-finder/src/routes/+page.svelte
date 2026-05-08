<script lang="ts">
  import "../styles/app.scss";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { open, save } from "@tauri-apps/plugin-dialog";

  let rootPath = $state("");
  let fileTypes = $state(".xml");
  let excludes = $state("*temp*, *backup*");
  let isDarkMode = $state(true);
  let result = $state<any>(null);
  let savedTo = $state("");
  let isSearching = $state(false);
  let isCancelled = $state(false);

  function clearResults() {
    if (!isSearching) {
      result = null;
      savedTo = "";
      isCancelled = false;
    }
  }

  function applyTheme() {
    document.body.classList.toggle("dark", isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? "#121212" : "#ffffff";
  }

  onMount(() => { applyTheme(); });

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
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

  async function runSearch() {
    if (!rootPath) return;
    isSearching = true;
    isCancelled = false;
    savedTo = "";
    result = null;
    let pathWasSelected = "";

    const types = fileTypes.split(",").map(s => s.trim());
    const excludeList = excludes.split(",").map(s => s.trim()).filter(s => s !== "");

    try {
      const data = await invoke<any>("search_files", {
        rootDir: rootPath,
        fileTypes: types,
        excludePatterns: excludeList,
        savePath: null
      });

      result = data;

      if (result.metadata.totalMatchingFiles > 0) {
        // IMPROVED NAMING LOGIC:
        // 1. Get components by splitting slashes
        const components = rootPath.split(/[/\\]/).filter(Boolean);

        // 2. Try to get the last folder, or fallback to the drive/root component
        let rootName = components.pop() || components[0] || "export";

        // 3. Clean rootName of characters that might be in a drive letter (like 'C:')
        // or network path that aren't valid in a filename
        rootName = rootName.replace(/[:\\/]/g, "");

        const ts = result.metadata.startTime
          .split('.')[0]
          .replace(/:/g, "-")
          .replace("T", "_");

        const defaultFilename = `${rootName}_${ts}.json`;

        const path = await save({
          title: "Save Search Results",
          filters: [{ name: 'JSON', extensions: ['json'] }],
          defaultPath: defaultFilename
        });

        if (path) {
          pathWasSelected = path;
          await invoke("search_files", {
            rootDir: rootPath,
            fileTypes: types,
            excludePatterns: excludeList,
            savePath: path
          });
        }
      }
    } catch (e) {
      if (e === "Operation cancelled by user") {
        isCancelled = true;
        result = null;
      } else {
        console.error("Search Error:", e);
      }
    } finally {
      isSearching = false;
      if (pathWasSelected) {
        savedTo = pathWasSelected;
      }
    }
  }
</script>

<main class="container">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1>FILE FINDER</h1>
    <button class="btn" onclick={toggleTheme} disabled={isSearching} style="font-size: 2rem; border: none; background: none;">
      {isDarkMode ? "🌙" : "☀️"}
    </button>
  </div>

  <div class="field">
    <label>ROOT SEARCH DIRECTORY</label>
    <div class="input-row">
      <input readonly value={rootPath} disabled={isSearching} placeholder="Select folder..." />
      <button class="btn" onclick={pickFolder} disabled={isSearching}>Browse</button>
    </div>
  </div>

  <div class="field">
    <label>EXTENSIONS</label>
    <input bind:value={fileTypes} oninput={clearResults} disabled={isSearching} placeholder=".txt, .json" />
  </div>

  <div class="field">
    <label>EXCLUSION PATTERNS</label>
    <input bind:value={excludes} oninput={clearResults} disabled={isSearching} placeholder="*temp*, *backup*" />
  </div>

  <div style="display: flex; gap: 10px; width: 100%;">
    <button class="btn primary" onclick={runSearch} disabled={!rootPath || isSearching}>
      {#if isSearching}<span class="spinner"></span>{/if}
      {isSearching ? "PROCESSING..." : "GENERATE JSON"}
    </button>

    {#if isSearching}
      <button class="btn" onclick={stopSearch} style="border-color: #ef4444; color: #ef4444; width: auto;">
        STOP
      </button>
    {/if}
  </div>

  {#if isCancelled || result}
    <div class="results-display">
      {#if isCancelled}
        <div style="padding: 12px; background: rgba(251, 191, 36, 0.15); border: 1px solid #fbbf24; border-radius: 6px;">
          <p class={isDarkMode ? "warning-text-dark" : "warning-text-light"} style="margin: 0;">
            🛑 <strong>Generation Stopped:</strong> The process was cancelled by the user.
          </p>
        </div>
      {:else if result}
        {#if result.metadata.totalMatchingFiles > 0}
          <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Files Found: <strong>{result.metadata.totalMatchingFiles}</strong>
          </p>
          <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Time Taken: <strong>{result.metadata.executionTimeFormatted}</strong>
          </p>

          {#if savedTo}
            <p class="success-text">✓ Saved to: {savedTo}</p>
          {:else if !isSearching}
            <p class={isDarkMode ? "warning-text-dark" : "warning-text-light"}>⚠ Results found, but not saved.</p>
          {/if}
        {:else}
          <p style="color: #ef4444; font-weight: 600; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px;">
            No files with the extension(s) "{fileTypes}" were found in the selected directory.
          </p>
          <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>
            Search took: <strong>{result.metadata.executionTimeFormatted}</strong>
          </p>
        {/if}
      {/if}
    </div>
  {/if}
</main>