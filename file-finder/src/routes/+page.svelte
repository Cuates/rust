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

  // Simple function to clear the UI
  function clearResults() {
    if (!isSearching) { // Don't clear if we're currently searching
      result = null;
      savedTo = "";
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
      clearResults(); // Ensure UI resets when a new folder is picked
    }
  }

  async function runSearch() {
    if (!rootPath) return;
    isSearching = true;
    savedTo = "";
    result = null; // Clear previous results

    const types = fileTypes.split(",").map(s => s.trim());
    const excludeList = excludes.split(",").map(s => s.trim()).filter(s => s !== "");

    try {
      // 1. Initial Scan
      const data = await invoke<any>("search_files", {
        rootDir: rootPath,
        fileTypes: types,
        excludePatterns: excludeList,
        savePath: null
      });

      result = data;

      // 2. ONLY proceed to save if files were actually found
      if (result.metadata.total_matching_files > 0) {
        const rootName = rootPath.split(/[/\\]/).filter(Boolean).pop() || "export";
        const ts = result.metadata.start_time
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
          await invoke("search_files", {
            rootDir: rootPath,
            fileTypes: types,
            excludePatterns: excludeList,
            savePath: path
          });
          savedTo = path;
        }
      }
      // If total_matching_files is 0, the code simply finishes here,
      // and the UI will handle the "No files found" message.

    } catch (e) {
      console.error(e);
    } finally {
      isSearching = false;
    }
  }
</script>

<main class="container">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h1>FILE FINDER</h1>
    <button class="btn" onclick={toggleTheme} style="font-size: 2rem; border: none; background: none;">
      {isDarkMode ? "🌙" : "☀️"}
    </button>
  </div>

  <!-- Folder Picker -->
  <div class="field">
    <label>ROOT SEARCH DIRECTORY</label>
    <div class="input-row">
      <!-- Input will now have the #2D2D2D / #FFFFFF theme -->
      <input readonly value={rootPath} placeholder="Select folder..." />
      <button class="btn" onclick={pickFolder}>
        Browse
      </button>
    </div>
  </div>

  <!-- Extensions Field -->
  <div class="field">
    <label>EXTENSIONS</label>
    <input
      bind:value={fileTypes}
      oninput={clearResults}
      placeholder=".txt, .json"
    />
  </div>

  <!-- Exclusions Field -->
  <div class="field">
    <label>EXCLUSION PATTERNS</label>
    <input
      bind:value={excludes}
      oninput={clearResults}
      placeholder="*temp*, *backup*"
    />
  </div>

  <button class="btn primary" onclick={runSearch} disabled={!rootPath || isSearching}>
    {isSearching ? "SEARCHING..." : "GENERATE JSON"}
  </button>

{#if result}
    <div class="results-display">
      {#if result.metadata.total_matching_files > 0}
        <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>Files Found: <strong>{result.metadata.total_matching_files}</strong></p>
        <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>Time Taken: <strong>{result.metadata.execution_time_formatted}</strong></p>

        {#if savedTo}
          <p class="success-text">✓ Saved to: {savedTo}</p>
        {:else if !isSearching}
          <p class={isDarkMode ? "warning-text-dark" : "warning-text-light"}>⚠ Results found, but not saved.</p>
        {/if}
      {:else}
        <p style="color: #ef4444; font-weight: 600; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px;">
          No files with the extension(s) "{fileTypes}" were found in the selected directory.
        </p>
        <p class={isDarkMode ? "dark-theme-text" : "light-theme-text"}>Search took: <strong>{result.metadata.execution_time_formatted}</strong></p>
      {/if}
    </div>
  {/if}
</main>