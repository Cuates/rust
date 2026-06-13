<script lang="ts">
  import { fade, scale } from 'svelte/transition';
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

  let {
    show = false,
    onClose
  }: {
    show: boolean;
    onClose: () => void;
  } = $props();

  let timeAgo = $state('');

  function updateTimeAgo() {
    const buildDate = new Date(__BUILD_DATE__);
    const diffMs = Date.now() - buildDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      timeAgo = 'today';
    } else if (diffDays === 1) {
      timeAgo = '1 day ago';
    } else {
      timeAgo = `${diffDays} days ago`;
    }
  }

  function toggleTheme() {
    appState.isDarkMode = !appState.isDarkMode;
    localStorage.setItem('app-theme', appState.isDarkMode ? 'dark' : 'light');
  }

  $effect(() => {
    if (show) {
      updateTimeAgo();
    }
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" transition:fade={{ duration: 150 }} onclick={onClose}>
    <div
      class="modal-card"
      transition:scale={{ duration: 150, start: 0.95 }}
      onclick={(e) => e.stopPropagation()}
    >
      <div class="modal-header">
        <div class="header-content">
          <img
            src="/logo.png"
            alt="App Logo"
            class="app-logo"
            onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
          />
          <h2>About MKV Filter Metadata</h2>
        </div>
        <button
          class="theme-toggle-icon-btn"
          onclick={toggleTheme}
          aria-label="Toggle color display theme"
        >
          {#if appState.isDarkMode}☀️{:else}🌙{/if}
        </button>
      </div>

      <div class="modal-body">
        <p class="summary">
          A powerful digital media optimization tool for remuxing and re-encoding video files
          without quality loss, designed specifically for fine-tuning MKV metadata and optimizing
          library storage.
        </p>

        <div class="scrollable-content">
          <div class="info-section">
            <h3>Application Details</h3>
            <ul>
              <li><strong>Version:</strong> {__APP_VERSION__}</li>
              <li><strong>Commit:</strong> {__COMMIT_HASH__}</li>
              <li>
                <strong>Build Date:</strong>
                {new Date(__BUILD_DATE__).toLocaleString()} ({timeAgo})
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
              <li>
                <span>📦</span> <strong>MKVMerge:</strong>
                {appState.mkvmergeVersion || 'Loading...'}
              </li>
            </ul>
          </div>

          <div class="info-section links">
            <a
              href="{GITHUB_REPO_PREFIX}tree/main/mkv-filter-metadata"
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => {
                e.preventDefault();
                openExternal(`${GITHUB_REPO_PREFIX}tree/main/mkv-filter-metadata`);
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
              href="{GITHUB_REPO_PREFIX}blob/main/mkv-filter-metadata/CHANGELOG.md"
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => {
                e.preventDefault();
                openExternal(`${GITHUB_REPO_PREFIX}blob/main/mkv-filter-metadata/CHANGELOG.md`);
              }}>Changelog</a
            >
            <span class="separator">•</span>
            <a
              href="{GITHUB_REPO_PREFIX}blob/main/mkv-filter-metadata/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              onclick={(e) => {
                e.preventDefault();
                openExternal(`${GITHUB_REPO_PREFIX}blob/main/mkv-filter-metadata/LICENSE`);
              }}>MIT License</a
            >
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" onclick={onClose}>Close</button>
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
    backdrop-filter: blur(3px);
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
    max-width: 500px;
    max-height: 90vh;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    padding: 1.2rem 1.5rem 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      .app-logo {
        height: 32px;
        width: auto;
        object-fit: contain;
      }

      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: var(--text-primary);
      }
    }

    .theme-toggle-icon-btn {
      background: transparent;
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
  }

  .modal-body {
    padding: 1rem 1.5rem 0 1.5rem;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .summary {
      font-size: 0.95rem;
      line-height: 1.5;
      margin-top: 0;
      margin-bottom: 1.5rem;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .scrollable-content {
      overflow-y: auto;
      padding-bottom: 1rem;
      padding-right: 0.5rem;
      margin-right: -0.5rem;
    }

    .info-section {
      margin-bottom: 1.5rem;

      h3 {
        font-size: 1rem;
        margin-top: 0;
        margin-bottom: 0.5rem;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 0.25rem;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.6;

        li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          strong {
            color: var(--text-primary);
          }
        }
      }

      .tech-stack {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.5rem;

        span {
          display: inline-flex;
          width: 20px;
          justify-content: center;
        }
      }
    }

    .links {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      margin-bottom: 0;
      font-size: 0.9rem;

      a {
        color: var(--accent-color);
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 0.25rem;

        &:hover {
          text-decoration: underline;
        }

        .icon {
          margin-bottom: 2px;
        }
      }

      .separator {
        color: var(--text-secondary);
      }
    }
  }

  .modal-footer {
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: flex-end;
    background-color: var(--bg-canvas);
    border-top: 1px solid var(--border-color);
  }

  .btn-cancel {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1.2rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background-color: var(--hover-color, rgba(255, 255, 255, 0.1));
      color: var(--text-primary);
    }
  }
</style>
