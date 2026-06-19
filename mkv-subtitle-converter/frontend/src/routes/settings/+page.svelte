<script lang="ts">
  import { config, resetConfigToDefaults, isConfigDefault } from '$lib/stores/config.svelte';
  import { isConflict } from '$lib/stores/shortcuts.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

  let showResetConfirm = $state(false);
  let editingShortcut: string | null = $state(null);

  const shortcutDescriptions: Record<string, string> = {
    addFolder: 'Add folder to queue',
    startConversion: 'Start conversion',
    stopConversion: 'Stop conversion',
    resetQueue: 'Reset / clear queue',
    openAbout: 'Open About',
    openSettings: 'Open Settings'
  };

  function captureKey(e: KeyboardEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    // Ignore isolated modifier presses
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    // Build the string
    let parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    // Capitalize key gracefully
    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toLowerCase();

    parts.push(keyName);
    const newPattern = parts.join('+');

    // Check for Escape to cancel
    if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey && id !== 'stopConversion') {
      editingShortcut = null;
      return;
    }

    if (isConflict(newPattern, id)) {
      toast.error(`Shortcut ${newPattern} is already in use!`);
      return;
    }

    config.shortcuts[id] = newPattern;
    editingShortcut = null;
  }

  function handleReset() {
    resetConfigToDefaults();
    showResetConfirm = false;
    toast.success('Settings reset to defaults');
  }
</script>

<svelte:head>
  <title>Settings - MKV Subtitle Extractor</title>
</svelte:head>

<main class="page">
  <div class="header">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/" class="back-link">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Back to Home
    </a>
    <h1>Settings</h1>
  </div>

  <div class="scrollable-content">
    <section class="settings-section">
      <h2>Processing Options</h2>

      <label class="toggle-label" for="recursive-toggle">
        <div class="toggle-control">
          <input
            id="recursive-toggle"
            type="checkbox"
            bind:checked={config.recursive}
            class="toggle-input"
          />
          <span class="toggle-track"></span>
        </div>
        <span class="toggle-text">
          <strong>Recursive scan</strong>
          <span>Include subdirectories when processing folders</span>
        </span>
      </label>

      <label class="toggle-label" for="save-queue-toggle">
        <div class="toggle-control">
          <input
            id="save-queue-toggle"
            type="checkbox"
            bind:checked={config.save_queue_list}
            class="toggle-input"
          />
          <span class="toggle-track"></span>
        </div>
        <span class="toggle-text">
          <strong>Remember queue</strong>
          <span>Restore folders in your queue on next launch</span>
        </span>
      </label>

      <div class="slider-group">
        <div class="slider-header">
          <strong>Parallel File Processing</strong>
          <span class="slider-value"
            >{config.concurrency} worker{config.concurrency > 1 ? 's' : ''}</span
          >
        </div>
        <span class="slider-desc"
          >Number of files to process simultaneously. Higher values use more CPU and disk I/O.</span
        >
        <input type="range" min="1" max="8" bind:value={config.concurrency} class="slider-input" />
      </div>

      <button
        class="btn btn-danger btn-outline mt-4"
        onclick={() => (showResetConfirm = true)}
        disabled={isConfigDefault()}
      >
        Reset to Defaults
      </button>
    </section>

    <section class="settings-section">
      <h2>Keyboard Shortcuts</h2>
      <p class="description">Customize the keyboard shortcuts for controlling the application.</p>

      <div class="shortcut-list">
        {#each Object.entries(config.shortcuts) as [id, pattern], i (id)}
          <div
            class="shortcut-row"
            style={i === Object.keys(config.shortcuts).length - 1
              ? 'border-bottom: none; padding-bottom: 0;'
              : ''}
          >
            <span class="shortcut-desc">{shortcutDescriptions[id] || id}:</span>
            {#if editingShortcut === id}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                id="shortcut-capture-input"
                type="text"
                class="shortcut-input editing"
                value="Press keys..."
                readonly
                autofocus
                onkeydown={(e) => captureKey(e, id)}
                onblur={() => (editingShortcut = null)}
              />
            {:else}
              <button class="shortcut-btn" onclick={() => (editingShortcut = id)}>
                {pattern}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  </div>

  {#if showResetConfirm}
    <ConfirmationModal
      title="Reset to Defaults"
      message="Are you sure you want to reset all settings to their original values? This action cannot be undone."
      confirmLabel="Reset"
      dangerous={true}
      onConfirm={handleReset}
      onCancel={() => (showResetConfirm = false)}
    />
  {/if}
</main>

<style lang="scss">
  .page {
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 20px 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100vh;
    overflow: hidden;
  }

  .header {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);

    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--text-primary);
    }
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-right: 8px; /* Give room for scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.15s;
    width: fit-content;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--accent-color);
    }
  }

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--bg-panel);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-color);

    h2 {
      margin: 0;
      font-size: 1.1rem;
      color: var(--text-primary);
    }
  }

  .description {
    margin: -10px 0 0 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .mt-4 {
    margin-top: 16px;
  }

  .btn-danger {
    background-color: transparent;
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background-color: rgba(239, 68, 68, 0.1);
      border-color: #ef4444;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      border-color: rgba(239, 68, 68, 0.2);
    }
  }

  /* Toggles */
  .toggle-label {
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;
    user-select: none;
    padding: 12px;
    background: var(--bg-surface);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    transition: border-color 0.15s;

    &:hover {
      border-color: var(--accent-color);
    }

    &:has(input:disabled) {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .toggle-control {
    position: relative;
    flex-shrink: 0;
  }

  .toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-track {
      background: var(--accent-color);

      &::after {
        transform: translateX(20px);
      }
    }

    &:focus-visible + .toggle-track {
      box-shadow: 0 0 0 2px var(--accent-color);
    }
  }

  .toggle-track {
    display: block;
    width: 44px;
    height: 24px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: background 0.2s;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      background: var(--text-secondary);
      border-radius: 50%;
      transition: transform 0.2s;
    }
  }

  .toggle-text {
    display: flex;
    flex-direction: column;

    strong {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    span {
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
  }

  /* Sliders */
  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .slider-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    strong {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .slider-value {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--accent-color);
      background: var(--bg-panel);
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }
  }

  .slider-desc {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .slider-input {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    outline: none;

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--accent-color);
      cursor: pointer;
      transition: transform 0.1s;
    }

    &::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);

    .shortcut-desc {
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
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    min-width: 120px;
    text-align: center;
    transition: border-color 0.15s;

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
    font-family: 'JetBrains Mono', monospace;
    min-width: 120px;
    text-align: center;
    outline: none;
  }
</style>
