<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { toastState, removeToast } from '$lib/stores/toast.svelte';
</script>

<div class="toast-container" aria-live="polite" aria-atomic="false">
  {#each toastState.toasts as toast (toast.id)}
    <div
      class="toast toast-{toast.type}"
      role="alert"
      in:fly={{ y: 20, duration: 300 }}
      out:fade={{ duration: 200 }}
    >
      <div class="toast-icon">
        {#if toast.type === 'success'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        {:else if toast.type === 'error'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        {:else if toast.type === 'warning'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            ></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        {/if}
      </div>

      <p class="toast-message">{toast.message}</p>

      <button
        class="toast-close"
        onclick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  {/each}
</div>

<style lang="scss">
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    width: max-content;
    max-width: 380px;
    color: var(--text-primary);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      border-radius: 10px 0 0 10px;
    }
  }

  .toast-success::before {
    background-color: #22c55e;
  }
  .toast-success .toast-icon {
    color: #22c55e;
  }

  .toast-error::before {
    background-color: var(--danger-color);
  }
  .toast-error .toast-icon {
    color: var(--danger-color);
  }

  .toast-warning::before {
    background-color: #eab308;
  }
  .toast-warning .toast-icon {
    color: #eab308;
  }

  .toast-info::before {
    background-color: var(--accent-color);
  }
  .toast-info .toast-icon {
    color: var(--accent-color);
  }

  .toast-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 2px;

    :global(svg) {
      width: 18px;
      height: 18px;
    }
  }

  .toast-message {
    flex: 1;
    font-size: 0.875rem;
    line-height: 1.5;
    word-break: break-word;
    margin: 0;
  }

  .toast-close {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 2px;
    margin: -2px -2px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s;
    flex-shrink: 0;

    &:hover {
      background-color: var(--bg-hover-panel);
      color: var(--text-primary);
    }

    svg {
      width: 15px;
      height: 15px;
    }
  }
</style>
