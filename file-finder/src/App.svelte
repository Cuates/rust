<script lang="ts">
  import "./styles/app.scss";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";

  // Svelte 5 Runes for reactive state
  let rootPath = $state("");
  let fileTypes = $state(".xml"); // Default from original script
  let excludes = $state("*temp*, *backup*"); // Parity with Python example[cite: 1]
  let result = $state<any>(null);
  let isSearching = $state(false);

  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected) rootPath = selected as string;
  }

  async function startSearch() {
    isSearching = true;
    try {
      // Replicating Python's argument logic for types and excludes[cite: 1]
      const typesList = fileTypes.split(",").map(s => s.trim());
      const excludeList = excludes.split(",").map(s => s.trim()).filter(s => s !== "");

      result = await invoke("search_files", {
        rootDir: rootPath,
        fileTypes: typesList,
        excludePatterns: excludeList
      });
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      isSearching = false;
    }
  }
</script>

<main class="container">
  <h1>FILE FINDER</h1>

  <div class="field">
    <label>Root Search Directory</label>
    <input value={rootPath} onclick={pickFolder} placeholder="Click to select folder..." readonly />
  </div>

  <div class="field">
    <label>Extensions (e.g., .xml, .json)</label>
    <input bind:value={fileTypes} />
  </div>

  <div class="field">
    <label>Exclusion Patterns (wildcards)</label>
    <input bind:value={excludes} />
  </div>

  <button class="primary-btn" onclick={startSearch} disabled={isSearching || !rootPath}>
    {isSearching ? "SCANNING..." : "GENERATE JSON"}
  </button>

  {#if result}
    <div class="summary-box">
      <p>Matching Files: <span>{result.metadata.total_matching_files}</span></p>
      <p>Dirs Processed: <span>{result.metadata.total_directories_processed}</span></p>
      <p>Time: <span>{result.metadata.execution_time_seconds.toFixed(4)}s</span></p>
    </div>
  {/if}
</main>