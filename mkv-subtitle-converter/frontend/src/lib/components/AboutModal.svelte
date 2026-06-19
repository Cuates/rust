<script lang="ts">
  import { appState } from '$lib/stores/config.svelte';
  import { openUrl } from '@tauri-apps/plugin-opener';

  async function openExternal(url: string) {
    try {
      await openUrl(url);
    } catch (e) {
      console.error('Failed to open external URL:', e);
    }
  }

  const GITHUB_REPO_PREFIX = 'https://github.com/Cuates/rust/';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let closeBtn = $state<HTMLButtonElement>();
  let modalContainer = $state<HTMLDivElement>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
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
      if (closeBtn) closeBtn.focus();
    }, 0);
  });
</script>

<svelte:window onkeydown={handleKeydown} />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal-backdrop"
  onclick={onClose}
  role="dialog"
  aria-modal="true"
  aria-label="About MKV Subtitle Extractor"
  tabindex="-1"
  bind:this={modalContainer}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>About</h2>
      <button bind:this={closeBtn} class="close-btn" onclick={onClose} aria-label="Close">
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

    <div class="modal-body">
      <div class="app-info">
        <div class="app-icon" aria-hidden="true">🎬</div>
        <div>
          <h3 class="app-name">MKV Subtitle Extractor Converter</h3>
          <p class="app-desc">
            Batch-extract embedded subtitle tracks from MKV files and convert them to ASS format
            using bundled FFmpeg sidecars.
          </p>
        </div>
      </div>

      <div class="scrollable-content">
        <div class="info-section">
          <h3>Application Details</h3>
          <ul>
            <li><strong>Version:</strong> {__APP_VERSION__}</li>
            <li><strong>Commit:</strong> {__COMMIT_HASH__}</li>
            <li>
              <strong>Build Date:</strong>
              {new Date(__BUILD_DATE__).toLocaleString()}
            </li>
            <li><strong>Author:</strong> Produced by Cuates</li>
            <li><strong>Copyright:</strong> © {new Date().getFullYear()}</li>
          </ul>
        </div>

        <div class="info-section">
          <h3>Technology Stack</h3>
          <ul class="tech-stack">
            <li><span>🦀</span> <strong>Tauri:</strong> {__TAURI_VERSION__}</li>
            <li><span>🔥</span> <strong>Svelte:</strong> {__SVELTE_VERSION__}</li>
            <li><span>🟢</span> <strong>Node.js:</strong> {__NODE_VERSION__}</li>
            <li>
              <span>🎞️</span> <strong>FFmpeg:</strong>
              {appState.ffmpegVersion || 'Loading...'}
            </li>
            <li>
              <span>🔎</span> <strong>FFprobe:</strong>
              {appState.ffprobeVersion || 'Loading...'}
            </li>
          </ul>
        </div>

        <div class="info-section links">
          <a
            href="{GITHUB_REPO_PREFIX}tree/main/mkv-subtitle-converter"
            target="_blank"
            rel="noopener noreferrer"
            onclick={(e) => {
              e.preventDefault();
              openExternal(`${GITHUB_REPO_PREFIX}tree/main/mkv-subtitle-converter`);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon"
              ><path
                d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
              ></path></svg
            >
            GitHub Repository
          </a>
          <span class="separator">•</span>
          <a
            href="{GITHUB_REPO_PREFIX}blob/main/mkv-subtitle-converter/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            onclick={(e) => {
              e.preventDefault();
              openExternal(`${GITHUB_REPO_PREFIX}blob/main/mkv-subtitle-converter/CHANGELOG.md`);
            }}>Changelog</a
          >
          <span class="separator">•</span>
          <a
            href="{GITHUB_REPO_PREFIX}blob/main/mkv-subtitle-converter/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            onclick={(e) => {
              e.preventDefault();
              openExternal(`${GITHUB_REPO_PREFIX}blob/main/mkv-subtitle-converter/LICENSE`);
            }}>MIT License</a
          >
        </div>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    width: 480px;
    max-width: 92vw;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border-color);

    h2 {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
    }
  }

  .close-btn {
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: all 0.15s;

    svg {
      width: 18px;
      height: 18px;
    }

    &:hover {
      background: var(--bg-hover-panel);
      color: var(--text-primary);
    }
  }

  .modal-body {
    padding: 20px 24px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
    overflow: hidden;
  }

  .app-info {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex-shrink: 0;
  }

  .app-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
    line-height: 1;
  }

  .app-name {
    font-size: 1rem;
    font-weight: 700;
    margin: 0 0 4px;
  }
  .app-desc {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.4;
    font-size: 0.95rem;
  }

  .scrollable-content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-top: 0.5rem;
    padding-bottom: 24px;
    padding-right: 8px;
    margin-right: -8px;
    flex: 1;
    overflow-y: auto;
  }

  .info-section {
    h3 {
      margin: 0 0 0.5rem;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-tertiary);
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.9rem;

      li {
        display: flex;
        align-items: center;

        strong {
          color: var(--text-primary);
          margin-right: 0.5rem;
          min-width: 80px;
        }

        color: var(--text-secondary);
      }
    }
  }

  .tech-stack {
    display: grid !important;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.5rem !important;

    li {
      background: var(--bg-surface);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: flex-start;
      font-size: 0.85rem !important;
      word-break: break-word;
      min-width: 0;

      span {
        margin-right: 0.5rem;
        font-size: 1.1rem;
        flex-shrink: 0;
      }

      strong {
        min-width: unset !important;
        margin-right: 0.25rem !important;
        flex-shrink: 0;
      }
    }
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding-top: 1rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--border-color);

    a {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-primary);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.15s;

      .icon {
        opacity: 0.8;
      }

      &:hover {
        color: var(--accent);
      }
    }

    .separator {
      color: var(--text-tertiary);
      font-size: 0.8rem;
    }
  }
</style>
