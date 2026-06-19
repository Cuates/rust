<script lang="ts">
  import { tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { save } from '@tauri-apps/plugin-dialog';
  import { toast } from '$lib/stores/toast.svelte';
  import { CMD_READ_SESSION_LOG, CMD_CHECK_SESSION_LOG, CMD_SAVE_LOG_FILE } from '$lib/constants';

  interface Props {
    logs: string[];
    maxHeight?: string;
  }

  let { logs, maxHeight = '300px' }: Props = $props();

  let containerEl: HTMLDivElement;
  let autoScroll = $state(true);
  let copiedStatus = $state(false);
  let savedStatus = $state(false);

  // Auto-scroll to bottom whenever new logs arrive.
  $effect(() => {
    if (logs.length > 0 && autoScroll) {
      tick().then(() => {
        if (containerEl) {
          containerEl.scrollTop = containerEl.scrollHeight;
        }
      });
    }
  });

  function handleScroll() {
    if (!containerEl) return;
    const { scrollTop, scrollHeight, clientHeight } = containerEl;
    // If the user scrolled up more than 40px from the bottom, disable auto-scroll.
    autoScroll = scrollHeight - scrollTop - clientHeight < 40;
  }

  function scrollToBottom() {
    if (containerEl) {
      containerEl.scrollTop = containerEl.scrollHeight;
      autoScroll = true;
    }
  }

  async function copyTerminalLogs() {
    if (logs.length === 0) return;

    try {
      const fullLogText = await invoke<string>(CMD_READ_SESSION_LOG);
      if (!fullLogText) {
        toast.error('No session log found on disk to copy.');
        return;
      }
      await navigator.clipboard.writeText(fullLogText);
      copiedStatus = true;
      setTimeout(() => {
        copiedStatus = false;
      }, 2000);
    } catch (err) {
      toast.error(`Failed to copy logs: ${err}`);
    }
  }

  async function saveTerminalLogs() {
    if (logs.length === 0) return;
    try {
      const logExists = await invoke<boolean>(CMD_CHECK_SESSION_LOG);
      if (!logExists) {
        toast.error('No active session log found to save.');
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

      const defaultFilename = `mkv_subtitle_converter_${dateStr}.log`;

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
        await invoke(CMD_SAVE_LOG_FILE, { path: filePath });

        savedStatus = true;
        setTimeout(() => {
          savedStatus = false;
        }, 2000);
      }
    } catch (err) {
      toast.error(`Failed to save log: ${err}`);
    }
  }

  function getLineClass(line: string): string {
    if (line.includes('[ERROR]') || line.includes('[FATAL]') || line.includes('❌')) {
      return 'log-error';
    }
    if (line.includes('[WARN]') || line.includes('⚠')) {
      return 'log-warn';
    }
    if (line.includes('✓') || line.includes('✅') || line.includes('Converted')) {
      return 'log-success';
    }
    if (line.startsWith('---') || line.startsWith('🚀') || line.startsWith('📦')) {
      return 'log-header';
    }
    if (line.includes('ℹ') || line.includes('Skipping')) {
      return 'log-info';
    }
    return '';
  }
</script>

<div class="terminal-container" style:height={maxHeight}>
  <div class="terminal-header-row">
    <h3>Real-time Output Pipeline Log</h3>
    {#if logs.length > 0}
      <div class="terminal-actions">
        <button
          class="icon-btn tooltip-left"
          class:success={savedStatus}
          onclick={saveTerminalLogs}
          aria-label="Export logs"
          data-tooltip={savedStatus ? 'Saved!' : 'Export logs'}
        >
          {#if savedStatus}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon"><polyline points="20 6 9 17 4 12"></polyline></svg
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
              class="icon"
              ><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
              ></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline
                points="7 3 7 8 15 8"
              ></polyline></svg
            >
          {/if}
        </button>
        <button
          class="icon-btn tooltip-left"
          class:success={copiedStatus}
          onclick={copyTerminalLogs}
          aria-label="Copy logs"
          data-tooltip={copiedStatus ? 'Copied!' : 'Copy logs'}
        >
          {#if copiedStatus}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon"><polyline points="20 6 9 17 4 12"></polyline></svg
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
              class="icon"
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
    class="terminal"
    bind:this={containerEl}
    onscroll={handleScroll}
    role="log"
    aria-live="polite"
    aria-label="Processing log output"
  >
    {#if logs.length === 0}
      <span class="log-placeholder">Output will appear here once processing starts…</span>
    {:else}
      {#each logs as line, i (i)}
        <div class="log-line {getLineClass(line)}">{line}</div>
      {/each}
    {/if}
  </div>

  {#if !autoScroll}
    <button
      class="scroll-btn"
      onclick={scrollToBottom}
      title="Scroll to latest"
      aria-label="Scroll to latest log entry"
    >
      ↓
    </button>
  {/if}
</div>

<style lang="scss">
  .terminal-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .terminal-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 28px;
    padding: 0 4px;

    h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .terminal-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;

    .icon-btn {
      background: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;

      .icon {
        width: 16px;
        height: 16px;
      }

      &:hover {
        background: var(--bg-hover-panel);
        border-color: var(--accent-color);
        color: var(--text-primary);
      }

      &.success {
        color: #22c55e;
        border-color: rgba(34, 197, 94, 0.3);
        background: rgba(34, 197, 94, 0.1);
      }
    }
  }

  .terminal {
    background: var(--bg-terminal, #0d1117);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 0.78rem;
    line-height: 1.7;
    color: var(--text-terminal, var(--text-secondary));
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    flex: 1;
    word-break: break-all;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--border-color);
      border-radius: 3px;
    }
  }

  .log-placeholder {
    color: var(--text-muted, #555);
    font-style: italic;
    font-size: 0.8rem;
  }

  .log-line {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .log-error {
    color: var(--danger-color, #f87171);
  }
  .log-warn {
    color: #eab308;
  }
  .log-success {
    color: #4ade80;
  }
  .log-header {
    color: var(--text-primary);
    font-weight: 500;
  }
  .log-info {
    color: #60a5fa;
  }

  .scroll-btn {
    position: absolute;
    bottom: 10px;
    right: 14px;
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
