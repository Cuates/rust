<script lang="ts">
  import {
    shortcuts,
    resetShortcutsToDefaults,
    isShortcutsDefault
  } from '../../lib/stores/shortcuts.svelte';
  import {
    config,
    resetConfigToDefaults,
    isConfigDefault,
    savedPresets,
    saveCurrentAsPreset,
    applyPreset,
    deletePreset
  } from '../../lib/stores/config.svelte';
  import { addToast } from '../../lib/stores/toast.svelte';
  import { pipeline } from '../../lib/stores/pipeline.svelte';
  import ConfirmationModal from '../../lib/components/ConfirmationModal.svelte';
  import { TAURI_COMMANDS, RESERVED_SHORTCUTS } from '../../lib/constants';
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  let recordingFor: 'startPipeline' | 'abortPipeline' | null = $state(null);
  let showResetModal = $state(false);
  let showClearHistoryModal = $state(false);
  let logicalCores = $state(8);
  let historyCount = $state<number | null>(null);
  let newPresetName = $state('');

  onMount(async () => {
    logicalCores = window.navigator.hardwareConcurrency || 8;
    try {
      historyCount = await invoke(TAURI_COMMANDS.GET_HISTORY_COUNT);
    } catch (e) {
      console.error('Failed to get history count:', e);
    }
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
      const comboStr = keyCombo.join('+');

      if (comboStr === RESERVED_SHORTCUTS.COMMAND_PALETTE) {
        addToast(
          `${RESERVED_SHORTCUTS.COMMAND_PALETTE} is reserved for the Command Palette.`,
          'error'
        );
        recordingFor = null;
        return;
      }

      shortcuts[field] = comboStr;
      recordingFor = null;
    }
  }

  function startRecording(field: 'startPipeline' | 'abortPipeline') {
    recordingFor = field;
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

  async function executeClearHistory() {
    try {
      await invoke(TAURI_COMMANDS.CLEAR_PROCESSING_HISTORY);
      historyCount = await invoke(TAURI_COMMANDS.GET_HISTORY_COUNT);
      showClearHistoryModal = false;
      addToast('✅ Database history cleared successfully.', 'success');
    } catch (e) {
      console.error(e);
      addToast(`❌ Failed to clear database history: ${e}`, 'error');
    }
  }
</script>

<svelte:head>
  <title>Settings - MKV Filter Metadata</title>
</svelte:head>

<main class="app-container">
  <header class="navbar-layer">
    <div style="display: flex; align-items: center; gap: 1rem;">
      <a class="back-btn" href="/" style="text-decoration: none;">←</a>
      <h1>Settings</h1>
    </div>
  </header>

  <div class="content-scroll-area">
    <div class="form-workspace-card">
      <h2>Appearance Settings</h2>
      <p class="description">Select your preferred application color theme.</p>
      <div class="segmented-control">
        <label>
          <input type="radio" value="system" bind:group={config.theme} />
          <span>System 💻</span>
        </label>
        <label>
          <input type="radio" value="light" bind:group={config.theme} />
          <span>Light ☀️</span>
        </label>
        <label>
          <input type="radio" value="dark" bind:group={config.theme} />
          <span>Dark 🌙</span>
        </label>
      </div>
    </div>

    <div class="form-workspace-card">
      <h2>General Settings</h2>
      <p class="description">Configure general application behaviors.</p>

      <div class="shortcut-row toggle-row">
        <span>System Notifications:</span>
        <label class="switch">
          <input id="notifications-toggle" type="checkbox" bind:checked={config.notifications} />
          <span class="slider round"></span>
        </label>
      </div>
    </div>

    <div class="form-workspace-card">
      <h2>Queue Settings</h2>
      <p class="description">Configure how the application processes and saves directories.</p>

      <div class="shortcut-row toggle-row">
        <span>Recursive Directory Scanning:</span>
        <label class="switch">
          <input
            id="recursive-scan"
            type="checkbox"
            bind:checked={config.recursive}
            disabled={pipeline.processingActive}
          />
          <span class="slider round"></span>
        </label>
      </div>

      <div class="shortcut-row toggle-row" style="border-bottom: none; padding-bottom: 0;">
        <span>Save Queue List Between Sessions:</span>
        <label class="switch">
          <input
            id="save-queue"
            type="checkbox"
            bind:checked={config.save_queue_list}
            disabled={pipeline.processingActive}
          />
          <span class="slider round"></span>
        </label>
      </div>
    </div>

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
        system resources. The chosen concurrency value dictates how many files will actively process
        at once in the main dashboard's UI Metrics Panel.
      </p>

      <div class="shortcut-row">
        <div style="width: 200px; display: flex; flex-direction: column;">
          <span>Target Drive Type:</span>
          <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;"
            >(Clamps max concurrency on HDDs)</span
          >
        </div>
        <div style="display: flex; align-items: center; justify-content: flex-end; flex: 1;">
          <div class="segmented-control" style="width: 100%; max-width: 300px;">
            <label>
              <input
                type="radio"
                value="ssd"
                bind:group={config.storage_type}
                onchange={() => {
                  if (config.storage_type === 'hdd') {
                    config.remux_concurrency = 1;
                  }
                }}
              />
              <span style="padding: 0.35rem; font-size: 0.85rem;">SSD / NVMe ⚡</span>
            </label>
            <label>
              <input
                type="radio"
                value="hdd"
                bind:group={config.storage_type}
                onchange={() => {
                  if (config.storage_type === 'hdd') {
                    config.remux_concurrency = 1;
                  }
                }}
              />
              <span style="padding: 0.35rem; font-size: 0.85rem;">HDD 💽</span>
            </label>
          </div>
        </div>
      </div>

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
            max={config.video_codec === 'libx264' || config.video_codec === 'libx265'
              ? 2
              : Math.min(logicalCores, 8)}
            bind:value={config.reencode_concurrency}
            style="flex: 1;"
          />
          <span
            style="width: 120px; display: inline-block; text-align: right; font-variant-numeric: tabular-nums;"
          >
            {config.reencode_concurrency} (Max: {config.video_codec === 'libx264' ||
            config.video_codec === 'libx265'
              ? 2
              : Math.min(logicalCores, 8)})
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
            max={config.storage_type === 'hdd' ? 1 : 8}
            bind:value={config.remux_concurrency}
            style="flex: 1;"
          />
          <span
            style="width: 120px; display: inline-block; text-align: right; font-variant-numeric: tabular-nums;"
          >
            {config.remux_concurrency} (Max: {config.storage_type === 'hdd' ? 1 : 8})
          </span>
        </div>
      </div>
    </div>

    <div class="form-workspace-card">
      <h2>Database History</h2>
      <p class="description">
        Clear the processed files history. This will cause the app to re-process files it has
        already seen if they are queued again.
      </p>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button
          class="danger-btn"
          onclick={() => (showClearHistoryModal = true)}
          disabled={historyCount === 0 || historyCount === null}
        >
          Clear Database History
        </button>
        {#if historyCount !== null}
          <span style="color: var(--text-secondary); font-size: 0.9rem; font-weight: 500;">
            {historyCount} records
          </span>
        {/if}
      </div>
    </div>

    <div class="form-workspace-card">
      <h2>Saved Presets</h2>
      <p class="description">
        Save your current workflow settings (codec, CRF, extensions, etc.) as a named preset for
        quick recall. Personal settings (theme, directories, notifications) are not saved.
      </p>

      <div class="preset-save-row">
        <input
          id="preset-name-input"
          class="preset-name-input"
          type="text"
          placeholder="Preset name…"
          bind:value={newPresetName}
          disabled={pipeline.processingActive}
          onkeydown={(e) => {
            if (e.key === 'Enter' && newPresetName.trim()) {
              saveCurrentAsPreset(newPresetName);
              addToast(`Preset "${newPresetName.trim()}" saved.`, 'success');
              newPresetName = '';
            }
          }}
        />
        <button
          class="preset-save-btn"
          disabled={!newPresetName.trim() || pipeline.processingActive}
          onclick={() => {
            saveCurrentAsPreset(newPresetName);
            addToast(`Preset "${newPresetName.trim()}" saved.`, 'success');
            newPresetName = '';
          }}
        >
          Save Current
        </button>
      </div>

      {#if savedPresets.length === 0}
        <p class="preset-empty">No presets saved yet.</p>
      {:else}
        <ul class="preset-list">
          {#each savedPresets as preset (preset.name)}
            <li class="preset-item">
              <span class="preset-item-name" title={preset.name}>{preset.name}</span>
              <div class="preset-item-actions">
                <button
                  class="preset-apply-btn"
                  disabled={pipeline.processingActive}
                  onclick={() => {
                    applyPreset(preset);
                    addToast(`Applied preset "${preset.name}".`, 'success');
                  }}
                >
                  Apply
                </button>
                <button
                  class="preset-delete-btn"
                  disabled={pipeline.processingActive}
                  onclick={() => {
                    deletePreset(preset.name);
                    addToast(`Preset "${preset.name}" deleted.`, 'info');
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
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

<ConfirmationModal
  show={showClearHistoryModal}
  title="Clear Database History"
  message="Are you sure you want to clear the database history? This will cause the app to re-process previously processed files if they are encountered again.&#10;&#10;This action cannot be undone."
  confirmText="Clear History"
  cancelText="Cancel"
  onConfirm={executeClearHistory}
  onCancel={() => (showClearHistoryModal = false)}
/>

<style lang="scss">
  /* Settings uses the global .app-container shell from app.scss.
     Override: single-column layout only (no three-tier grid needed here). */
  .app-container {
    max-width: none;
  }

  .content-scroll-area {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1rem;
    padding-right: 0.5rem;
    margin-right: -0.5rem;
  }

  .navbar-layer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0 0.5rem 0;
    margin-bottom: 1rem;
    flex-shrink: 0;

    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
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

  .toggle-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  /* Toggle Switch Styles */
  .switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border-color);
    transition: 0.4s;
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--accent-color);
  }

  input:disabled + .slider {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input:checked + .slider:before {
    transform: translateX(16px);
  }

  .form-workspace-card {
    padding: 1.5rem;
    gap: 1.5rem;
    flex: none;
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

    &:hover:not(:disabled) {
      background-color: var(--danger-hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .segmented-control {
    display: flex;
    background-color: var(--bg-body);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.25rem;
    gap: 0.25rem;

    label {
      flex: 1;
      text-align: center;
      position: relative;
      cursor: pointer;

      input[type='radio'] {
        position: absolute;
        opacity: 0;
      }

      span {
        display: block;
        padding: 0.5rem;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--text-secondary);
        transition: all 0.2s ease;
      }

      input[type='radio']:checked + span {
        background-color: var(--accent-color);
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
        font-weight: 600;
      }
    }
  }

  /* ─── Saved Presets ─── */
  .preset-save-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .preset-name-input {
    flex: 1;
    background-color: var(--bg-body);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.15s;

    &:focus:not(:disabled) {
      border-color: var(--accent-color);
    }
  }

  .preset-save-btn {
    background-color: var(--accent-color);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      background-color: var(--accent-hover);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .preset-empty {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .preset-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .preset-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background-color: var(--bg-body);
  }

  .preset-item-name {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .preset-item-actions {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
  }

  .preset-apply-btn {
    background-color: transparent;
    color: var(--accent-color);
    border: 1px solid var(--accent-color);
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;

    &:hover:not(:disabled) {
      background-color: var(--accent-color);
      color: white;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .preset-delete-btn {
    background-color: transparent;
    color: var(--danger-color);
    border: 1px solid transparent;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.82rem;
    cursor: pointer;
    transition: all 0.15s;

    &:hover:not(:disabled) {
      border-color: var(--danger-color);
      background-color: rgba(239, 68, 68, 0.08);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
