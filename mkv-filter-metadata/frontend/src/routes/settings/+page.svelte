<script lang="ts">
  import {
    shortcuts,
    resetShortcutsToDefaults,
    isShortcutsDefault
  } from '../../lib/stores/shortcuts.svelte';
  import {
    config,
    appState,
    resetConfigToDefaults,
    isConfigDefault
  } from '../../lib/stores/config.svelte';
  import { addToast } from '../../lib/stores/toast.svelte';
  import ConfirmationModal from '../../lib/components/ConfirmationModal.svelte';
  import { onMount } from 'svelte';

  let recordingFor: 'startPipeline' | 'abortPipeline' | null = $state(null);
  let showResetModal = $state(false);
  let logicalCores = $state(8);

  onMount(() => {
    logicalCores = window.navigator.hardwareConcurrency || 8;
  });

  function handleKeydown(e: KeyboardEvent, field: 'startPipeline' | 'abortPipeline') {
    e.preventDefault();

    const keyCombo = [];
    if (e.ctrlKey) keyCombo.push('Ctrl');
    if (e.shiftKey) keyCombo.push('Shift');
    if (e.altKey) keyCombo.push('Alt');

    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();

    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      keyCombo.push(key);
      shortcuts[field] = keyCombo.join('+');
      recordingFor = null;
    }
  }

  function startRecording(field: 'startPipeline' | 'abortPipeline') {
    recordingFor = field;
  }

  function toggleTheme() {
    appState.isDarkMode = !appState.isDarkMode;
    localStorage.setItem('app-theme', appState.isDarkMode ? 'dark' : 'light');
  }

  function handleReset() {
    showResetModal = true;
  }

  function executeReset() {
    if (isConfigDefault() && isShortcutsDefault()) {
      showResetModal = false;
      addToast('ℹ️ Settings and shortcuts are already at their default values.', 'info');
      return;
    }

    resetConfigToDefaults();
    resetShortcutsToDefaults();
    showResetModal = false;
    addToast('✅ Settings and shortcuts restored to defaults.', 'success');
  }
</script>

<svelte:head>
  <title>Settings - MKV Filter Metadata</title>
</svelte:head>

<main class="app-container">
  <header class="navbar-layer">
    <div style="display: flex; align-items: center; gap: 1rem;">
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a class="back-btn" href="/" style="text-decoration: none;">←</a>
      <h1>Settings</h1>
    </div>
    <div class="nav-actions">
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
    <h2>Keyboard Shortcuts</h2>
    <p class="description">Customize the keyboard shortcuts for controlling the application.</p>

    <div class="shortcut-row">
      <span>Start Processing:</span>
      {#if recordingFor === 'startPipeline'}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          value="Recording..."
          class="shortcut-input recording"
          onkeydown={(e) => handleKeydown(e, 'startPipeline')}
          onblur={() => (recordingFor = null)}
          autofocus
        />
      {:else}
        <button class="shortcut-btn" onclick={() => startRecording('startPipeline')}>
          {shortcuts.startPipeline}
        </button>
      {/if}
    </div>

    <div class="shortcut-row" style="border-bottom: none; padding-bottom: 0;">
      <span>Abort Execution:</span>
      {#if recordingFor === 'abortPipeline'}
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="text"
          value="Recording..."
          class="shortcut-input recording"
          onkeydown={(e) => handleKeydown(e, 'abortPipeline')}
          onblur={() => (recordingFor = null)}
          autofocus
        />
      {:else}
        <button class="shortcut-btn" onclick={() => startRecording('abortPipeline')}>
          {shortcuts.abortPipeline}
        </button>
      {/if}
    </div>
  </div>

  <div class="form-workspace-card">
    <h2>Performance Settings</h2>
    <p class="description">
      Adjust processing concurrency. Higher values process more files simultaneously but use more
      system resources.
    </p>

    <div class="shortcut-row">
      <div style="width: 200px; display: flex; flex-direction: column;">
        <span>Re-encode Concurrency:</span>
        <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;"
          >(Recommended: 1-2 CPU, 2-4 GPU)</span
        >
      </div>
      <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
        <input
          type="range"
          min="1"
          max={Math.min(logicalCores, 8)}
          bind:value={config.reencode_concurrency}
          style="flex: 1;"
        />
        <span
          style="width: 120px; display: inline-block; text-align: right; font-variant-numeric: tabular-nums;"
        >
          {config.reencode_concurrency} (Max: {Math.min(logicalCores, 8)})
        </span>
      </div>
    </div>

    <div class="shortcut-row" style="border-bottom: none; padding-bottom: 0;">
      <div style="width: 200px; display: flex; flex-direction: column;">
        <span>Remux Concurrency:</span>
        <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;"
          >(Recommended: 2-4 HDD, 4-8 SSD)</span
        >
      </div>
      <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
        <input
          type="range"
          min="1"
          max="8"
          bind:value={config.remux_concurrency}
          style="flex: 1;"
        />
        <span
          style="width: 120px; display: inline-block; text-align: right; font-variant-numeric: tabular-nums;"
        >
          {config.remux_concurrency} (Max: 8)
        </span>
      </div>
    </div>
  </div>

  <div class="form-workspace-card">
    <h2>Reset Defaults</h2>
    <p class="description">
      Restore all application settings, configurations, and keyboard shortcuts back to their
      original state.
    </p>
    <div>
      <button class="danger-btn" onclick={handleReset}>Reset to Defaults</button>
    </div>
  </div>
</main>

<ConfirmationModal
  show={showResetModal}
  title="Reset to Defaults"
  message="Are you sure you want to reset all settings and shortcuts to their default values?&#10;&#10;This action cannot be undone."
  confirmText="Reset Defaults"
  cancelText="Cancel"
  onConfirm={executeReset}
  onCancel={() => (showResetModal = false)}
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
    gap: 1rem;
  }

  .navbar-layer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0 0.5rem 0;
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

  .back-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: var(--accent-color);
    }
  }

  .form-workspace-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .description {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);

    span {
      font-weight: 500;
      color: var(--text-primary);
    }
  }

  .shortcut-btn {
    background-color: var(--bg-body);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: monospace;
    cursor: pointer;
    min-width: 120px;
    text-align: center;

    &:hover {
      border-color: var(--accent-color);
    }
  }

  .shortcut-input {
    background-color: var(--bg-body);
    border: 1px solid var(--accent-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    min-width: 120px;
    text-align: center;
    outline: none;

    &.recording {
      color: var(--accent-color);
      animation: pulse 1.5s infinite;
    }
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      opacity: 1;
    }
  }

  .danger-btn {
    background-color: var(--danger-color);
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--danger-hover);
    }
  }
</style>
