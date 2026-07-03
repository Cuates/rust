<script lang="ts">
  import { filterCommands, paletteState, type AppCommand } from '../stores/commands.svelte';

  let query = $state('');
  let selectedIndex = $state(0);

  let filtered = $derived(filterCommands(query));

  // Reset selection when results change
  let searchInput = $state<HTMLInputElement>();

  $effect(() => {
    // Reset selected index when query changes
    void query;
    selectedIndex = 0;
  });

  $effect(() => {
    if (searchInput) {
      setTimeout(() => {
        searchInput?.focus();
      }, 10);
    }
  });

  let modalContainer = $state<HTMLDivElement>();

  function executeCommand(command: AppCommand): void {
    if (!command.enabled()) return;
    command.action();
    paletteState.isOpen = false;
  }

  function handleWindowKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // prevent propagation to page-level abort handler
      paletteState.isOpen = false;
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) executeCommand(cmd);
      return;
    }
    if (e.key === 'Tab' && modalContainer) {
      const focusableElements = modalContainer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // If focus is currently outside the modal, force it to the first element
      if (!modalContainer.contains(document.activeElement)) {
        e.preventDefault();
        if (e.shiftKey) {
          lastElement.focus();
        } else {
          firstElement.focus();
        }
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      paletteState.isOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="palette-backdrop"
  role="dialog"
  aria-modal="true"
  aria-label="Command palette"
  tabindex="-1"
  onclick={handleBackdropClick}
>
  <div class="palette-panel" bind:this={modalContainer}>
    <div class="palette-search-row">
      <svg
        class="palette-search-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        id="command-palette-input"
        bind:this={searchInput}
        class="palette-input"
        type="text"
        placeholder="Type a command…"
        bind:value={query}
        autocomplete="off"
        spellcheck={false}
        autofocus
      />
      <kbd class="palette-esc-hint">Esc</kbd>
    </div>

    <ul class="palette-list" role="listbox" aria-label="Commands">
      {#if filtered.length === 0}
        <li class="palette-empty">No commands match "{query}"</li>
      {:else}
        {#each filtered as command, i (command.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <li
            class="palette-item"
            class:selected={i === selectedIndex}
            class:disabled={!command.enabled()}
            role="option"
            aria-selected={i === selectedIndex}
            aria-disabled={!command.enabled()}
            onclick={() => executeCommand(command)}
            onmouseenter={() => (selectedIndex = i)}
          >
            <span class="palette-item-label">{command.label}</span>
            {#if command.shortcutHint}
              <kbd class="palette-item-shortcut">{command.shortcutHint}</kbd>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </div>
</div>

<style lang="scss">
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1000;
  }

  .palette-panel {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    width: min(520px, 90vw);
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
      0 24px 48px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* ── Search row ── */
  .palette-search-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .palette-search-icon {
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .palette-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.95rem;
    color: var(--text-primary);
    font-family: inherit;

    &::placeholder {
      color: var(--text-secondary);
    }
  }

  .palette-esc-hint {
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    font-family: monospace;
    flex-shrink: 0;
  }

  /* ── Command list ── */
  .palette-list {
    list-style: none;
    margin: 0;
    padding: 0.35rem;
    overflow-y: auto;
    flex: 1;
  }

  .palette-empty {
    padding: 1rem;
    text-align: center;
    font-size: 0.88rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .palette-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.55rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-primary);

    &.selected {
      background: color-mix(in srgb, var(--accent-color) 15%, transparent);
      color: var(--text-primary);
    }

    &.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .palette-item-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .palette-item-shortcut {
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    font-family: monospace;
    flex-shrink: 0;
  }
</style>
