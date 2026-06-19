<script lang="ts">
  interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    dangerous?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  }

  let {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    dangerous = false,
    onConfirm,
    onCancel
  }: Props = $props();

  let confirming = $state(false);

  async function handleConfirm() {
    confirming = true;
    try {
      await onConfirm();
    } finally {
      confirming = false;
    }
  }

  let modalContainer = $state<HTMLDivElement>();
  let cancelBtn = $state<HTMLButtonElement>();

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
        if (document.activeElement === firstElement || document.activeElement === document.body) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement || document.activeElement === document.body) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }

  $effect(() => {
    setTimeout(() => {
      if (cancelBtn) cancelBtn.focus();
    }, 0);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="modal-backdrop" onclick={onCancel} role="button" tabindex="-1">
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    bind:this={modalContainer}
  >
    <div class="modal-header">
      <h2>{title}</h2>
    </div>
    <div class="modal-body">
      <p>{message}</p>
    </div>
    <div class="modal-footer">
      <button
        class="btn btn-secondary"
        onclick={onCancel}
        disabled={confirming}
        bind:this={cancelBtn}
      >
        {cancelLabel}
      </button>
      <button
        class="btn"
        class:btn-danger={dangerous}
        class:btn-primary={!dangerous}
        onclick={handleConfirm}
        disabled={confirming}
      >
        {#if confirming}
          <span class="spinner"></span>
        {/if}
        {confirmLabel}
      </button>
    </div>
  </div>
</div>

<style lang="scss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  }

  .modal-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    width: 380px;
    max-width: 90vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 22px 0;
    h2 {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
    }
  }

  .modal-body {
    padding: 14px 22px 20px;
    p {
      font-size: 0.87rem;
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0;
    }
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--border-color);
    background: var(--bg-surface);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.85rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    background: var(--accent-color);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  }

  .btn-secondary {
    background: var(--bg-panel);
    border-color: var(--border-color);
    color: var(--text-primary);

    &:hover:not(:disabled) {
      background: var(--bg-hover-panel);
    }
  }

  .btn-danger {
    background: var(--danger-color);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(1.1);
    }
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
