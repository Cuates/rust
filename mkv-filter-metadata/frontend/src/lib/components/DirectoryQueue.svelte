<script lang="ts">
  import { open } from '@tauri-apps/plugin-dialog';
  import { config } from '../stores/config.svelte';
  import { pipeline } from '../stores/pipeline.svelte';
  import { buildTooltip } from '../utils/formatters';

  let isDragging = $state(false);
  let pointerDraggingIndex = $state<number | null>(null);
  let pointerStartY = $state(0);
  let pointerCurrentY = $state(0);
  const ITEM_HEIGHT = 36;
  let autoScrollDirection = 0;
  let autoScrollRAF: number | null = null;
  let queueBoxEl = $state<HTMLElement | null>(null);

  export function handleDragDrop(paths: string[]) {
    const newPaths = paths.filter((p) => !config.input_directories.includes(p));
    config.input_directories = [...config.input_directories, ...newPaths];
  }

  async function handleDirectoryBrowse() {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: true,
        title: 'Select Input Video Processing Directory'
      });
      if (selectedPath) {
        if (Array.isArray(selectedPath)) {
          const newPaths = selectedPath.filter((p) => !config.input_directories.includes(p));
          config.input_directories = [...config.input_directories, ...newPaths];
        } else {
          if (!config.input_directories.includes(selectedPath as string)) {
            config.input_directories = [...config.input_directories, selectedPath as string];
          }
        }
      }
    } catch (err) {
      pipeline.consoleLogs = [
        ...pipeline.consoleLogs,
        `❌ Directory browser access failure: ${err}`
      ];
    }
  }

  function clearAllDirectories() {
    config.input_directories = [];
    pipeline.consoleLogs = [];
    pipeline.totalFilesCount = 0;
    pipeline.currentFileIndex = 0;
    pipeline.overallProgress = 0;
    pipeline.intraFileProgress = 0;
    pipeline.currentFilename = '';
    pipeline.runningTimeFormatted = '0ms';
    pipeline.showMetricsPanel = false;
    pipeline.directoryStatuses = {};
    pipeline.directoryErrors = {};
    pipeline.currentActiveDirectory = null;
    pipeline.directoryStats = {};
    pipeline.hasProcessClicked = false;
  }

  function removeDirectory(index: number) {
    const updatedDirs = [...config.input_directories];
    updatedDirs.splice(index, 1);
    config.input_directories = updatedDirs;
    if (config.input_directories.length === 0) {
      clearAllDirectories();
    }
  }

  function handlePointerDown(e: PointerEvent, index: number) {
    if (pipeline.processingActive) return;
    if ((e.target as HTMLElement).closest('.remove-btn')) return;
    e.preventDefault();
    pointerDraggingIndex = index;
    pointerStartY = e.clientY;
    pointerCurrentY = e.clientY;
  }

  function startAutoScroll() {
    if (autoScrollRAF !== null) return;
    function scrollStep() {
      if (pointerDraggingIndex === null || autoScrollDirection === 0) {
        stopAutoScroll();
        return;
      }
      if (!queueBoxEl) {
        stopAutoScroll();
        return;
      }
      const speed = 2;
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
    if (pointerDraggingIndex === null) return;
    let deltaY = pointerCurrentY - pointerStartY;
    while (deltaY > ITEM_HEIGHT && pointerDraggingIndex < config.input_directories.length - 1) {
      const newDirs = [...config.input_directories];
      const temp = newDirs[pointerDraggingIndex];
      newDirs[pointerDraggingIndex] = newDirs[pointerDraggingIndex + 1];
      newDirs[pointerDraggingIndex + 1] = temp;
      config.input_directories = newDirs;
      pointerDraggingIndex++;
      pointerStartY += ITEM_HEIGHT;
      deltaY = pointerCurrentY - pointerStartY;
    }
    while (deltaY < -ITEM_HEIGHT && pointerDraggingIndex > 0) {
      const newDirs = [...config.input_directories];
      const temp = newDirs[pointerDraggingIndex];
      newDirs[pointerDraggingIndex] = newDirs[pointerDraggingIndex - 1];
      newDirs[pointerDraggingIndex - 1] = temp;
      config.input_directories = newDirs;
      pointerDraggingIndex--;
      pointerStartY -= ITEM_HEIGHT;
      deltaY = pointerCurrentY - pointerStartY;
    }
  }

  export function handleGlobalPointerMove(e: PointerEvent) {
    if (pointerDraggingIndex === null) return;
    let clampedY = e.clientY;
    if (queueBoxEl) {
      const rect = queueBoxEl.getBoundingClientRect();
      const scrollThreshold = 15;
      if (clampedY < rect.top) clampedY = rect.top;
      else if (clampedY > rect.bottom) clampedY = rect.bottom;
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

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!pipeline.processingActive) isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }
</script>

<div class="row queue-header-row">
  <div class="queue-header">
    <label for="queue-box">Target Processing Queue ({config.input_directories.length})</label>
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      {#if config.input_directories.length > 0}
        <button
          class="clear-queue-btn"
          onclick={clearAllDirectories}
          disabled={pipeline.processingActive}
          title="Clear entire queue"
          aria-label="Clear entire processing queue"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><polyline points="3 6 5 6 21 6"></polyline><path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            ></path><line x1="10" y1="11" x2="10" y2="17"></line><line
              x1="14"
              y1="11"
              x2="14"
              y2="17"
            ></line></svg
          >
        </button>
      {/if}
      <button
        class="add-folder-btn"
        onclick={handleDirectoryBrowse}
        disabled={pipeline.processingActive}
      >
        + Add Folder to Queue
      </button>
    </div>
  </div>
  <div
    bind:this={queueBoxEl}
    id="queue-box"
    class="queue-container {isDragging ? 'dragging' : ''}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDragLeave}
    role="button"
    tabindex="0"
  >
    {#if config.input_directories.length === 0}
      <div class="empty-queue-msg">Drag & drop video folders here or click Add Folder...</div>
    {:else}
      {#each config.input_directories as dir, i (dir)}
        <div
          class="queue-item {pointerDraggingIndex === i ? 'dragging-item' : ''} {pipeline
            .directoryStatuses[dir] === 'processing'
            ? 'status-processing'
            : ''} {pipeline.directoryStatuses[dir] === 'done' && !pipeline.directoryErrors[dir]
            ? 'status-done'
            : ''} {pipeline.directoryStatuses[dir] === 'done' && pipeline.directoryErrors[dir]
            ? 'status-warning'
            : ''} {pipeline.directoryStatuses[dir] === 'skipped'
            ? 'status-skipped'
            : ''} {pipeline.processingActive ? 'is-locked' : ''}"
          style={pointerDraggingIndex === i
            ? `transform: translateY(${
                i === 0 && pointerCurrentY - pointerStartY < 0
                  ? Math.max(pointerCurrentY - pointerStartY, -20)
                  : i === config.input_directories.length - 1 && pointerCurrentY - pointerStartY > 0
                    ? Math.min(pointerCurrentY - pointerStartY, 20)
                    : pointerCurrentY - pointerStartY
              }px); z-index: 10; position: relative;`
            : ''}
          onpointerdown={(e) => handlePointerDown(e, i)}
          role="listitem"
        >
          <div class="queue-path-wrapper">
            {#if pipeline.directoryStatuses[dir] === 'processing'}
              <div class="status-indicator processing" title="Processing...">
                <svg class="spinner" viewBox="0 0 50 50"
                  ><circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"
                  ></circle></svg
                >
              </div>
            {:else if pipeline.directoryStatuses[dir] === 'done'}
              {#if pipeline.directoryErrors[dir]}
                <div class="status-indicator warning" title="Finished with warnings or errors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    ></path><line x1="12" y1="9" x2="12" y2="13"></line><line
                      x1="12"
                      y1="17"
                      x2="12.01"
                      y2="17"
                    ></line></svg
                  >
                </div>
              {:else}
                <div class="status-indicator done" title="Finished successfully">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg
                  >
                </div>
              {/if}
            {:else if pipeline.directoryStatuses[dir] === 'skipped'}
              <div
                class="status-indicator skipped"
                title={pipeline.directoryStats[dir] && !pipeline.directoryStats[dir].exists
                  ? 'Skipped (Directory does not exist)'
                  : 'Skipped (Directory is empty)'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="5 4 15 12 5 20 5 4"></polygon><line
                    x1="19"
                    y1="5"
                    x2="19"
                    y2="19"
                  ></line></svg
                >
              </div>
            {/if}
            <span class="queue-path" title={dir}>{dir}</span>
          </div>
          <div class="queue-actions" style="display: flex; align-items: center; gap: 0.25rem;">
            {#if pipeline.hasProcessClicked && pipeline.directoryStats[dir]}
              {#if !pipeline.directoryStats[dir].exists}
                <div class="info-circle issue" title={buildTooltip(pipeline.directoryStats[dir])}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"
                    ></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg
                  >
                </div>
              {:else}
                <div class="info-circle" title={buildTooltip(pipeline.directoryStats[dir])}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"
                    ></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg
                  >
                </div>
              {/if}
            {/if}
            <button
              class="remove-btn"
              onclick={() => removeDirectory(i)}
              disabled={pipeline.processingActive}
              aria-label="Remove item from path processing queue"
              title="Remove directory from processing queue"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
                ></line></svg
              >
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style lang="scss">
  .queue-header-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.1rem;
    gap: 0.5rem;
    width: 100%;

    label {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      flex-grow: 1;
    }
  }

  .add-folder-btn {
    background-color: var(--bg-surface);
    color: var(--accent-color);
    border: 1px solid var(--accent-color);
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    width: fit-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background-color: var(--accent-color);
      color: white;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .clear-queue-btn {
    background-color: var(--bg-surface);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.4rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background-color: #ff4d4d;
      color: white;
      border-color: #ff4d4d;
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .queue-container {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    min-height: 164px;
    max-height: 164px;
    overflow-y: auto;
    padding: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    transition: all 0.2s ease-in-out;

    &.dragging {
      border-color: var(--accent-color);
      background-color: rgba(59, 130, 246, 0.05);
      outline: 1px dashed var(--accent-color);
    }
  }

  .empty-queue-msg {
    padding: 0.6rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding-top: 3.7rem;
    pointer-events: none;
  }

  .queue-item {
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    align-items: center !important;
    background-color: var(--bg-surface);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    transition:
      background-color 0.2s ease,
      opacity 0.2s ease;

    &:hover {
      cursor: grab;
    }
    &:active {
      cursor: grabbing;
    }
    &.is-locked {
      &:hover,
      &:active {
        cursor: default;
      }
    }
    &.dragging-item {
      opacity: 0.9;
      background-color: var(--border-color);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    &.status-processing {
      border-color: var(--accent-color);
    }
    &.status-done {
      border-color: #22c55e;
    }
    &.status-warning {
      border-color: #f59e0b;
    }
    &.status-skipped {
      border-color: var(--text-secondary);
    }
  }

  .info-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    cursor: help;
    color: var(--text-secondary);

    &.issue {
      color: #ff4d4d;
    }
  }

  .queue-path-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: default;

    &.done {
      color: #22c55e;
    }
    &.warning {
      color: #f59e0b;
    }
    &.processing {
      color: var(--accent-color);
    }
    &.skipped {
      color: var(--text-secondary);
    }
  }

  .spinner {
    animation: rotate 2s linear infinite;
    width: 14px;
    height: 14px;

    .path {
      stroke: currentColor;
      stroke-linecap: round;
      animation: dash 1.5s ease-in-out infinite;
    }
  }

  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }

  .queue-path {
    font-size: 0.85rem;
    color: var(--text-primary);
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    padding-right: 0.5rem;
  }

  .remove-btn {
    background: none !important;
    border: none !important;
    color: var(--danger-color) !important;
    cursor: default;
    padding: 0.25rem !important;
    border-radius: 4px;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    transition: background-color 0.15s;
    position: relative;

    &:hover:not(:disabled) {
      background-color: rgba(239, 68, 68, 0.15) !important;
    }
    &:disabled {
      cursor: not-allowed !important;
      opacity: 0.5;
    }
  }
</style>
