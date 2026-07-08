<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import { pipeline } from '$lib/stores/pipeline.svelte';
  import { addToast } from '../stores/toast.svelte';
  import { getLogClass } from '../utils/logClassifier';
  import { TAURI_COMMANDS, UI_STRINGS } from '../constants';

  let copiedStatus = $state(false);
  let savedStatus = $state(false);
  let terminalEl = $state<HTMLElement | null>(null);
  let isAtTop = $state(true);
  let isAtBottom = $state(true);

  function handleScroll() {
    if (!terminalEl) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalEl;
    isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    isAtTop = scrollTop < 10;
  }

  export function scrollToBottom(force = false) {
    if (terminalEl && (isAtBottom || force)) {
      terminalEl.scrollTop = terminalEl.scrollHeight;
    }
  }

  function handleScrollToBottom() {
    isAtBottom = true;
    if (terminalEl) {
      terminalEl.scrollTo({ top: terminalEl.scrollHeight, behavior: 'smooth' });
    }
  }

  function handleScrollToTop() {
    if (terminalEl) {
      terminalEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function copyTerminalLogs() {
    /* v8 ignore next */
    if (pipeline.consoleLogs.length === 0) return;

    try {
      const fullLogText = await invoke<string>(TAURI_COMMANDS.READ_SESSION_LOG);
      if (!fullLogText) {
        addToast(UI_STRINGS.NO_SESSION_LOG, 'error');
        return;
      }
      await navigator.clipboard.writeText(fullLogText);
      copiedStatus = true;
      setTimeout(() => {
        copiedStatus = false;
      }, 2000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast(`${UI_STRINGS.COPY_LOGS_FAILED} ${errMsg}`, 'error');
    }
  }

  async function saveTerminalLogs() {
    /* v8 ignore next */
    if (pipeline.consoleLogs.length === 0) return;
    try {
      const logExists = await invoke<boolean>(TAURI_COMMANDS.CHECK_SESSION_LOG);
      if (!logExists) {
        addToast(UI_STRINGS.NO_ACTIVE_SESSION_LOG, 'error');
        return;
      }

      const now = new Date();
      // Format: YYYYMMDD_HHMMSS
      const dateStr =
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

      const defaultFilename = `${UI_STRINGS.LOG_FILE_PREFIX}${dateStr}.log`;

      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: 'Log Files',
            extensions: ['log']
          }
        ]
      });

      if (filePath) {
        await invoke(TAURI_COMMANDS.SAVE_LOG_FILE, { path: filePath });

        savedStatus = true;
        setTimeout(() => {
          savedStatus = false;
        }, 2000);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      addToast(`${UI_STRINGS.SAVE_LOG_FAILED} ${errMsg}`, 'error');
    }
  }
</script>

<div class="terminal-container">
  <div class="terminal-header-row">
    <h3>{UI_STRINGS.REALTIME_OUTPUT_LOG_TITLE}</h3>
    {#if pipeline.consoleLogs.length > 0}
      <div class="terminal-actions">
        <button
          class="copy-logs-btn {savedStatus ? 'copied' : ''}"
          onclick={saveTerminalLogs}
          aria-label={UI_STRINGS.EXPORT_LOGS}
          data-tooltip={savedStatus ? UI_STRINGS.SAVED : UI_STRINGS.EXPORT_LOGS}
        >
          {#if savedStatus}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
            >
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
              ></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline
                points="7 3 7 8 15 8"
              ></polyline></svg
            >
          {/if}
        </button>
        <button
          class="copy-logs-btn {copiedStatus ? 'copied' : ''}"
          onclick={copyTerminalLogs}
          aria-label={UI_STRINGS.COPY_LOGS}
          data-tooltip={copiedStatus ? UI_STRINGS.COPIED : UI_STRINGS.COPY_LOGS}
        >
          {#if copiedStatus}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
            >
          {:else}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              ></path></svg
            >
          {/if}
        </button>
      </div>
    {/if}
  </div>
  <div
    bind:this={terminalEl}
    id="terminal-shell"
    class="terminal-shell"
    onscroll={handleScroll}
    aria-live="polite"
    aria-atomic="false"
  >
    {#each pipeline.consoleLogs as log (log.id)}
      <div class="log-line {getLogClass(log.text)}">{log.text}</div>
    {:else}
      <div class="empty-log-msg">{UI_STRINGS.LOGS_WILL_APPEAR}</div>
    {/each}
  </div>

  <div class="scroll-buttons">
    {#if !isAtTop && pipeline.consoleLogs.length > 0}
      <button
        class="scroll-btn"
        onclick={handleScrollToTop}
        title={UI_STRINGS.SCROLL_TO_TOP}
        aria-label={UI_STRINGS.SCROLL_TO_TOP}
      >
        ↑
      </button>
    {/if}
    {#if !isAtBottom && pipeline.consoleLogs.length > 0}
      <button
        class="scroll-btn"
        onclick={handleScrollToBottom}
        title={UI_STRINGS.SCROLL_TO_LATEST}
        aria-label={UI_STRINGS.SCROLL_TO_LATEST}
      >
        ↓
      </button>
    {/if}
  </div>
</div>

<style lang="scss">
  .terminal-container {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    height: 350px;
    flex-shrink: 0;
    position: relative;
  }

  .terminal-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 24px;

    h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 500;
    }
  }

  .terminal-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .copy-logs-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    width: 26px;
    height: 26px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    transition: all 0.15s ease-in-out;

    &:hover {
      background-color: var(--bg-hover-panel);
      color: var(--text-primary);
    }
    &:active {
      transform: scale(0.92);
    }
    &.copied {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }
    svg {
      display: block;
      width: 14px;
      height: 14px;
      stroke: currentColor;
    }

    &::before {
      content: attr(data-tooltip);
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      transform: translateY(-4px);
      z-index: 99;
      background-color: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      font-family:
        system-ui,
        -apple-system,
        sans-serif;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
      transition:
        opacity 0.12s ease,
        transform 0.12s ease;
    }

    &:hover::before,
    &.copied::before {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .terminal-shell {
    background-color: var(--terminal-bg);
    color: var(--terminal-text);
    font-family: monospace;
    padding: 0.75rem;
    border-radius: 6px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    font-size: 0.85rem;
    border: 1px solid var(--border-color);
    box-sizing: border-box;
  }

  .log-line {
    margin-bottom: 0.25rem;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: left;
  }

  .log-error {
    color: var(--danger-color);
    font-weight: 600;
  }
  .log-warning {
    color: #eab308;
  }
  .log-success {
    color: #22c55e;
  }
  .log-info {
    color: var(--accent-color);
  }

  .empty-log-msg {
    color: var(--text-secondary);
    font-style: italic;
    opacity: 0.5;
    text-align: center;
    padding-top: 4rem;
  }

  .scroll-buttons {
    position: absolute;
    bottom: 12px;
    right: 22px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 50;
  }

  .scroll-btn {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;

    &:hover {
      background: var(--accent-color);
      color: #fff;
      border-color: var(--accent-color);
    }
  }
</style>
