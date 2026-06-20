<script lang="ts">
  import { baseName } from '$lib/utils/formatters';
  import { invoke } from '@tauri-apps/api/core';
  import { config } from '$lib/stores/config.svelte';
  import { CMD_GET_DIRECTORY_STATS, CMD_READ_REPORT_FILE } from '$lib/constants';

  interface ReportItem {
    path?: string;
    file?: string;
    name?: string;
    error?: string;
  }

  interface Props {
    folders: string[];
    disabled?: boolean;
    directoryStatuses?: Record<string, string>;
    folderCounts?: Record<string, number>;
    completedFilesPerDir?: Record<string, number>;
    onAdd: () => void;
    onRemove: (folder: string) => void;
    onClearAll: () => void;
    onReorder: (newFolders: string[]) => void;
    isDragging?: boolean;
  }

  let {
    folders,
    disabled = false,
    directoryStatuses = {},
    folderCounts = {},
    completedFilesPerDir = {},
    onAdd,
    onRemove,
    onClearAll,
    onReorder,
    isDragging = false
  }: Props = $props();

  let pointerDraggingIndex = $state<number | null>(null);
  let pointerStartY = $state(0);
  let pointerCurrentY = $state(0);

  let autoScrollDirection = 0;
  let autoScrollRAF: number | null = null;
  let queueBoxEl = $state<HTMLElement | null>(null);
  let statsCache = $state<Record<string, number>>({});
  let filesCache = $state<Record<string, string[]>>({});
  let expandedReports = $state<
    Record<string, { converted: ReportItem[]; failed: (ReportItem | string)[] } | null>
  >({});

  $effect(() => {
    folders.forEach(async (folder) => {
      if (statsCache[folder] === undefined) {
        try {
          const stats = await invoke<{ file_count: number; files: { name: string }[] }>(
            CMD_GET_DIRECTORY_STATS,
            {
              dirPath: folder,
              recursive: config.recursive
            }
          );
          statsCache = { ...statsCache, [folder]: stats.file_count };
          filesCache = { ...filesCache, [folder]: stats.files.map((f) => f.name) };
        } catch (e) {
          console.error('Failed to get directory stats', e);
        }
      }
    });
  });

  function getTooltip(folder: string): string | undefined {
    const files = filesCache[folder];
    if (!files || files.length === 0) return undefined;
    if (files.length <= 10) return files.join('\n');
    return [...files.slice(0, 10), `...and ${files.length - 10} more`].join('\n');
  }

  async function toggleReport(folder: string) {
    if (expandedReports[folder]) {
      expandedReports[folder] = null;
      return;
    }

    let converted: ReportItem[] = [];
    let failed: (ReportItem | string)[] = [];

    try {
      const c = await invoke<string>(CMD_READ_REPORT_FILE, {
        dirPath: folder,
        reportType: 'success'
      });
      const parsed = JSON.parse(c);
      converted = parsed.files || [];
    } catch {
      // ignore empty or missing report
    }

    try {
      const f = await invoke<string>(CMD_READ_REPORT_FILE, {
        dirPath: folder,
        reportType: 'failure'
      });
      const parsed = JSON.parse(f);
      failed = parsed.failed_files || [];
    } catch {
      // ignore empty or missing report
    }

    expandedReports = { ...expandedReports, [folder]: { converted, failed } };
  }

  function handlePointerDown(e: PointerEvent, index: number) {
    if (disabled) return;
    if ((e.target as HTMLElement).closest('.icon-btn')) return;
    e.preventDefault();
    pointerDraggingIndex = index;
    pointerStartY = e.clientY;
    pointerCurrentY = e.clientY;
    // Set pointer capture to prevent pointercancel during native drags
    if (e.target instanceof Element) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture errors
      }
    }
  }

  function startAutoScroll() {
    if (autoScrollRAF !== null) return;
    function scrollStep() {
      if (pointerDraggingIndex === null || autoScrollDirection === 0 || !queueBoxEl) {
        stopAutoScroll();
        return;
      }
      const speed = 3;
      const deltaScroll = autoScrollDirection * speed;
      const before = queueBoxEl.scrollTop;
      queueBoxEl.scrollTop += deltaScroll;
      const actualScroll = queueBoxEl.scrollTop - before;
      if (actualScroll !== 0) {
        pointerStartY -= actualScroll;
        checkSwapLogic();
      }
      autoScrollRAF = requestAnimationFrame(scrollStep);
    }
    autoScrollRAF = requestAnimationFrame(scrollStep);
  }

  function stopAutoScroll() {
    if (autoScrollRAF !== null) {
      cancelAnimationFrame(autoScrollRAF);
      autoScrollRAF = null;
    }
    autoScrollDirection = 0;
  }

  function checkSwapLogic() {
    if (pointerDraggingIndex === null || !queueBoxEl) return;
    let deltaY = pointerCurrentY - pointerStartY;

    const items = queueBoxEl.querySelectorAll('.folder-item');
    if (items.length <= 1) return;

    if (deltaY > 0 && pointerDraggingIndex < folders.length - 1) {
      const currentItem = items[pointerDraggingIndex] as HTMLElement;
      const nextItem = items[pointerDraggingIndex + 1] as HTMLElement;
      if (!currentItem || !nextItem) return;

      const swapOffset =
        nextItem.offsetTop +
        nextItem.offsetHeight -
        (currentItem.offsetTop + currentItem.offsetHeight);
      const threshold = swapOffset / 2;

      if (deltaY > threshold) {
        const newDirs = [...folders];
        const temp = newDirs[pointerDraggingIndex];
        newDirs[pointerDraggingIndex] = newDirs[pointerDraggingIndex + 1];
        newDirs[pointerDraggingIndex + 1] = temp;
        onReorder(newDirs);
        pointerDraggingIndex++;
        pointerStartY += swapOffset;
      }
    } else if (deltaY < 0 && pointerDraggingIndex > 0) {
      const currentItem = items[pointerDraggingIndex] as HTMLElement;
      const prevItem = items[pointerDraggingIndex - 1] as HTMLElement;
      if (!currentItem || !prevItem) return;

      const swapOffset = currentItem.offsetTop - prevItem.offsetTop;
      const threshold = swapOffset / 2;

      if (deltaY < -threshold) {
        const newDirs = [...folders];
        const temp = newDirs[pointerDraggingIndex];
        newDirs[pointerDraggingIndex] = newDirs[pointerDraggingIndex - 1];
        newDirs[pointerDraggingIndex - 1] = temp;
        onReorder(newDirs);
        pointerDraggingIndex--;
        pointerStartY -= swapOffset;
      }
    }
  }

  export function handleGlobalPointerMove(e: PointerEvent) {
    if (pointerDraggingIndex === null) return;
    let clampedY = e.clientY;
    if (queueBoxEl) {
      const rect = queueBoxEl.getBoundingClientRect();
      const scrollThreshold = 15;
      const itemOffset = 54;
      if (clampedY < rect.top - itemOffset) clampedY = rect.top - itemOffset;
      else if (clampedY > rect.bottom + itemOffset) clampedY = rect.bottom + itemOffset;

      if (e.clientY < rect.top + scrollThreshold) {
        autoScrollDirection = -1;
        startAutoScroll();
      } else if (e.clientY > rect.bottom - scrollThreshold) {
        autoScrollDirection = 1;
        startAutoScroll();
      } else {
        stopAutoScroll();
      }
    }
    pointerCurrentY = clampedY;
    checkSwapLogic();
  }

  export function handleGlobalPointerUp() {
    pointerDraggingIndex = null;
    stopAutoScroll();
  }
</script>

<svelte:window onpointermove={handleGlobalPointerMove} onpointerup={handleGlobalPointerUp} />

<div class="queue-section" class:drag-active={isDragging}>
  <div class="queue-header">
    <div class="queue-title">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="icon"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        ></path>
      </svg>
      <span>Folder Queue</span>
      <span class="badge">{folders.length}</span>
    </div>

    <div style="display: flex; gap: 8px;">
      {#if folders.length > 0}
        <button
          class="btn btn-secondary btn-sm"
          onclick={onClearAll}
          {disabled}
          title="Clear All (Ctrl+R)"
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
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6M14 11v6"></path>
          </svg>
          Clear All
        </button>
      {/if}

      <button
        class="btn btn-secondary btn-sm"
        onclick={onAdd}
        {disabled}
        title="Add Folder (Ctrl+O)"
        id="btn-add-folder"
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
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Folder
      </button>
    </div>
  </div>

  {#if isDragging}
    <div class="drag-overlay" aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <p>Drop folders here</p>
    </div>
  {:else if folders.length === 0}
    <div class="queue-empty">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        ></path>
      </svg>
      <p>No folders added yet</p>
      <span>Click "Add Folder" or drag folders here</span>
    </div>
  {:else}
    <ul class="folder-list" aria-label="Folder queue" bind:this={queueBoxEl}>
      {#each folders as folder, i (folder)}
        <li
          class="folder-item status-{directoryStatuses[folder] || 'idle'} {isDragging
            ? 'grabbing'
            : ''}"
          class:dragging-item={pointerDraggingIndex === i}
          style={pointerDraggingIndex === i
            ? `transform: translateY(${
                i === 0 && pointerCurrentY - pointerStartY < 0
                  ? Math.max(pointerCurrentY - pointerStartY, -20)
                  : i === folders.length - 1 && pointerCurrentY - pointerStartY > 0
                    ? Math.min(pointerCurrentY - pointerStartY, 20)
                    : pointerCurrentY - pointerStartY
              }px); z-index: 10; position: relative;`
            : ''}
          onpointerdown={(e) => handlePointerDown(e, i)}
        >
          <div class="folder-row">
            <div class="folder-info">
              {#if directoryStatuses[folder]}
                {#if directoryStatuses[folder] === 'processing'}
                  <span class="status-icon-wrap" title="Processing...">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon spinner"
                    >
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                  </span>
                {:else if directoryStatuses[folder] === 'done'}
                  <span class="status-icon-wrap" title="Successfully converted all subtitles">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#22c55e"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </span>
                {:else if directoryStatuses[folder] === 'error'}
                  <span class="status-icon-wrap" title="Failed to process some files">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  </span>
                {:else if directoryStatuses[folder] === 'warning'}
                  <span class="status-icon-wrap" title="Processed with warnings">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#f59e0b"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon"
                    >
                      <path
                        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                      ></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </span>
                {:else if directoryStatuses[folder] === 'skipped'}
                  <span class="status-icon-wrap" title="Skipped (No convertible tracks found)">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#888"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </span>
                {:else}
                  <span class="status-icon-wrap" title="Pending">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="folder-icon"
                    >
                      <path
                        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                      ></path>
                    </svg>
                  </span>
                {/if}
              {:else}
                <span class="status-icon-wrap" title="Pending">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="folder-icon"
                  >
                    <path
                      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                    ></path>
                  </svg>
                </span>
              {/if}
              <div class="folder-name-group">
                <span class="folder-name" title={folder}>
                  {baseName(folder)}
                  {#if folderCounts[folder] !== undefined}
                    <span class="badge badge-outline" title={getTooltip(folder)}
                      >{folderCounts[folder]} files</span
                    >
                  {:else if statsCache[folder] !== undefined && statsCache[folder] > 0}
                    <span class="badge badge-outline" title={getTooltip(folder)}
                      >{statsCache[folder]} files</span
                    >
                  {/if}
                </span>
                <span class="folder-path" title={folder}>{folder}</span>
                {#if directoryStatuses[folder] === 'processing' && folderCounts[folder] !== undefined}
                  {@const total = folderCounts[folder]}
                  {@const completed = completedFilesPerDir[folder] || 0}
                  {@const percent = total > 0 ? (completed / total) * 100 : 0}
                  <div class="folder-progress">
                    <div class="progress-bar-bg">
                      <div class="progress-bar-fill" style="width: {percent}%"></div>
                    </div>
                    <span class="progress-text">{completed} / {total} files</span>
                  </div>
                {/if}
              </div>
            </div>

            <div class="folder-actions">
              {#if directoryStatuses[folder] && directoryStatuses[folder] !== 'skipped' && directoryStatuses[folder] !== 'idle' && directoryStatuses[folder] !== 'processing'}
                <button
                  class="btn btn-secondary btn-sm"
                  onclick={() => toggleReport(folder)}
                  title="Toggle Report"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    style="transform: {expandedReports[folder]
                      ? 'rotate(180deg)'
                      : 'none'}; transition: transform 0.2s;"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                  {expandedReports[folder] ? 'Hide Report' : 'View Report'}
                </button>
              {/if}

              <button
                class="icon-btn icon-btn-danger"
                onclick={() => onRemove(folder)}
                {disabled}
                title="Remove from queue"
                aria-label="Remove {baseName(folder)} from queue"
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
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                  <path d="M10 11v6M14 11v6"></path>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                </svg>
              </button>
            </div>
          </div>
          {#if expandedReports[folder]}
            <div class="report-summary">
              {#if expandedReports[folder].converted.length > 0}
                <div class="report-section success">
                  <h4>Successfully Converted ({expandedReports[folder].converted.length})</h4>
                  <ul>
                    {#each expandedReports[folder].converted as file, idx (idx)}
                      <li>{baseName(file.path || file.file || file.name || '')}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if expandedReports[folder].failed.length > 0}
                <div class="report-section danger">
                  <h4>Failed ({expandedReports[folder].failed.length})</h4>
                  <ul>
                    {#each expandedReports[folder].failed as file, idx (idx)}
                      <li>
                        {#if typeof file === 'string'}
                          {file}
                        {:else}
                          <strong
                            >{baseName(
                              typeof file === 'string'
                                ? file
                                : file.path || file.file || file.name || ''
                            )}</strong
                          >
                          - {typeof file === 'string' ? '' : file.error || 'Unknown error'}
                        {/if}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
              {#if expandedReports[folder].converted.length === 0 && expandedReports[folder].failed.length === 0}
                <div class="report-section">No files were processed.</div>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style lang="scss">
  .queue-section {
    background: var(--bg-panel);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 16px;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    &.drag-active {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }
  }

  .queue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .queue-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);

    .icon {
      width: 16px;
      height: 16px;
      color: var(--accent-color);
    }
  }

  .badge {
    background: var(--accent-color);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 10px;
    min-width: 20px;
    text-align: center;
    display: inline-block;
  }

  .badge-outline {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    margin-left: 8px;
    vertical-align: middle;
  }

  .drag-overlay {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 120px;
    border: 2px dashed var(--accent-color);
    border-radius: 8px;
    color: var(--accent-color);

    svg {
      width: 40px;
      height: 40px;
    }

    p {
      font-size: 0.95rem;
      font-weight: 500;
      margin: 0;
    }
  }

  .queue-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 100px;
    color: var(--text-muted, #555);

    svg {
      width: 36px;
      height: 36px;
      opacity: 0.4;
    }

    p {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-secondary);
      margin: 0;
    }

    span {
      font-size: 0.78rem;
    }
  }

  .report-summary {
    margin-top: 12px;
    padding: 12px;
    background: var(--bg-surface, #1e1e24);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--text-secondary);

    .report-section {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      h4 {
        margin: 0 0 6px 0;
        font-size: 0.9rem;
        font-weight: 600;
      }

      &.success h4 {
        color: #22c55e;
      }

      &.danger h4 {
        color: #ef4444;
      }

      ul {
        margin: 0;
        padding-left: 20px;
        list-style-type: disc;

        li {
          margin-bottom: 4px;
        }
      }
    }
  }

  .folder-list {
    list-style: none;
    padding: 2px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .folder-item {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-left: 4px solid transparent;
    border-radius: 8px;
    transition:
      transform 0.1s,
      box-shadow 0.1s,
      border-left-color 0.2s,
      border-left-width 0.2s;
    user-select: none;
    touch-action: none;
    position: relative;
    z-index: 1;

    &.grabbing {
      cursor: grabbing;
      z-index: 10;
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    &.status-processing {
      border-left-color: #3b82f6;
    }
    &.status-done {
      border-left-color: #22c55e;
    }
    &.status-error {
      border-left-color: #ef4444;
    }
    &.status-warning {
      border-left-color: #eab308;
    }

    &:hover {
      border-color: var(--accent-color);
      cursor: grab;
    }

    &:active {
      cursor: grabbing;
    }

    &.dragging-item {
      opacity: 0.9;
      background-color: var(--border-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      transition: none !important;
    }
  }

  .folder-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .folder-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
    cursor: default;
  }

  .status-icon-wrap {
    display: flex;
    cursor: help;
  }

  .folder-icon {
    width: 16px;
    height: 16px;
    color: var(--accent-color);
    flex-shrink: 0;
    pointer-events: none;

    &.spinner {
      animation: spin 1.5s linear infinite;
    }
  }

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }

  .folder-name-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0; // prevent text overflow pushing layout
  }

  .folder-name {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-path {
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'JetBrains Mono', monospace;
  }

  .folder-progress {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 6px;
  }

  .progress-bar-bg {
    flex: 1;
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--accent-color);
    transition: width 0.3s ease-out;
  }

  .progress-text {
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
    min-width: 60px;
    text-align: right;
  }

  .folder-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .icon-btn {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 5px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      background: var(--bg-hover-panel);
      border-color: var(--border-color);
      color: var(--text-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.icon-btn-danger:hover {
      background: rgba(239, 68, 68, 0.12);
      border-color: var(--danger-color);
      color: var(--danger-color);
    }
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 0.82rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;

    svg {
      width: 14px;
      height: 14px;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  .btn-secondary {
    background: var(--bg-surface);
    border-color: var(--border-color);
    color: var(--text-primary);

    &:hover:not(:disabled) {
      background: var(--accent-color);
      border-color: var(--accent-color);
      color: #fff;
    }
  }

  .btn-sm {
    padding: 5px 10px;
    font-size: 0.78rem;
  }

  .text-red-500 {
    color: var(--danger-color, #ef4444);
  }

  .text-green-500 {
    color: #22c55e;
  }

  .status-icon-wrap {
    display: inline-flex;
    align-items: center;
  }
</style>
