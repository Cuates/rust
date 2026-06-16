<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  let {
    show = false,
    title = 'Confirm',
    message = 'Are you sure?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel
  }: {
    show: boolean;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let cancelBtn = $state<HTMLButtonElement>();
  let modalContainer = $state<HTMLDivElement>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

    if (e.key === 'Tab' && modalContainer) {
      const focusableElements = modalContainer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  $effect(() => {
    if (show) {
      // Use setTimeout to ensure DOM is updated before focusing
      setTimeout(() => {
        if (cancelBtn) cancelBtn.focus();
      }, 0);
    }
  });
</script>

{#if show}
  <div
    class="modal-backdrop"
    role="presentation"
    tabindex="-1"
    onkeydown={handleKeydown}
    transition:fade={{ duration: 150 }}
    onclick={onCancel}
    bind:this={modalContainer}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      tabindex="-1"
      transition:scale={{ duration: 150, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <h2 id="confirm-title">{title}</h2>
      </div>
      <div class="modal-body">
        <p>{message}</p>
      </div>
      <div class="modal-footer">
        <button bind:this={cancelBtn} class="btn-cancel" onclick={onCancel}>{cancelText}</button>
        <button class="btn-confirm" onclick={onConfirm}>{confirmText}</button>
      </div>
    </div>
  </div>
{/if}

<style lang="scss">
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    padding: 1.2rem 1.5rem 0.5rem;
    h2 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--text-primary);
    }
  }

  .modal-body {
    padding: 1rem 1.5rem;
    p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--text-primary);
      white-space: pre-wrap;
    }
  }

  .modal-footer {
    padding: 1.2rem 1.5rem;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    background-color: var(--bg-canvas);
    border-top: 1px solid var(--border-color);
  }

  button {
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-cancel {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);

    &:hover {
      background-color: var(--hover-color, rgba(255, 255, 255, 0.1));
      color: var(--text-primary);
    }
  }

  .btn-confirm {
    background-color: var(--error-color, #ff4c4c);
    color: white;

    &:hover {
      filter: brightness(1.1);
    }
  }
</style>
