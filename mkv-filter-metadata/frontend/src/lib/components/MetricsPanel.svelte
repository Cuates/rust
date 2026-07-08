<script lang="ts">
  import { pipeline } from '$lib/stores/pipeline.svelte';
  import { formatBytes } from '../utils/formatters';
  import { UI_STRINGS } from '../constants';

  /** True once the user has ever started a run in this session. */
  let hasEverRun = $derived(pipeline.hasProcessClicked);
</script>

<!--
  MetricsPanel is always mounted. It never conditionally appears/disappears,
  eliminating the layout jump that occurred on every pipeline start.
  Content inside transitions between three states:
    1. Idle (never run)    — placeholder
    2. Active              — live progress bars
    3. Last Run (summary)  — post-run summary card
-->
<div
  class="metrics-panel-row"
  aria-live="polite"
  aria-atomic="false"
  style="container-type: inline-size;"
>
  {#if pipeline.processingActive}
    <!-- ── Active state ── -->
    <div class="active-content">
      <div class="progress-container-block">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: {pipeline.overallProgress}%"></div>
        </div>
        <div class="progress-labels-sub-row">
          <span class="sub-metric-label"
            >{UI_STRINGS.TOTAL_SCANNED} <strong>{pipeline.currentFileIndex}</strong> / {pipeline.totalFilesCount}
            file(s)</span
          >
          <span class="sub-metric-label text-right"
            >{UI_STRINGS.OVERALL_PROGRESS} <strong>{pipeline.overallProgress}%</strong></span
          >
        </div>
        <div class="progress-labels-sub-row" style="margin-top: 0.15rem; margin-bottom: 0.2rem;">
          <span class="sub-metric-label"
            >{UI_STRINGS.TOTAL_SIZE}
            <strong>{formatBytes(pipeline.totalScannedBytes)}</strong></span
          >
        </div>
        {#each pipeline.activeTaskList as activeFile (activeFile.filename)}
          <div class="progress-bar-track intra-track">
            <div class="progress-bar-fill intra-fill" style="width: {activeFile.progress}%;"></div>
          </div>
          <div class="progress-labels-sub-row intra-row">
            <span class="sub-metric-label intra-label" title={activeFile.filename}>
              {UI_STRINGS.PROCESSING} <strong>{activeFile.filename}</strong>
            </span>
            <span class="sub-metric-label text-right intra-value">
              <strong>{activeFile.progress.toFixed(1)}%</strong>
            </span>
          </div>
        {/each}
      </div>
      <div class="time-container-block">
        <span class="total-time-title">{UI_STRINGS.TOTAL_CONVERSION_TIME}</span>
        <span class="total-time-value">{pipeline.runningTimeFormatted}</span>
        <span class="total-time-title" style="margin-left: 1rem;">{UI_STRINGS.ETA}</span>
        <span class="total-time-value">{pipeline.etaFormatted}</span>
      </div>
    </div>
  {:else if hasEverRun && pipeline.lastRunSummary}
    <!-- ── Last Run summary card ── -->
    <div class="last-run-content">
      <p class="last-run-title">{UI_STRINGS.LAST_RUN}</p>
      <div class="last-run-grid">
        <div class="last-run-stat">
          <span class="stat-label">{UI_STRINGS.FILES_PROCESSED}</span>
          <span class="stat-value">{pipeline.lastRunSummary.filesProcessed}</span>
        </div>
        <div class="last-run-stat">
          <span class="stat-label">{UI_STRINGS.DURATION}</span>
          <span class="stat-value">{pipeline.lastRunSummary.timeFormatted}</span>
        </div>
        {#if pipeline.lastRunSummary.originalBytes > 0}
          <div class="last-run-stat">
            <span class="stat-label">{UI_STRINGS.STORAGE_DELTA}</span>
            <span
              class="stat-value"
              style="color: {pipeline.lastRunSummary.storageSavedPercent >= 0.01
                ? '#22c55e'
                : pipeline.lastRunSummary.storageSavedPercent <= -0.01
                  ? 'var(--danger-color)'
                  : 'var(--text-primary)'};"
            >
              {pipeline.lastRunSummary.storageSavedPercent >= 0.01
                ? '+'
                : ''}{pipeline.lastRunSummary.storageSavedPercent.toFixed(2)}% ({formatBytes(
                pipeline.lastRunSummary.originalBytes
              )} →
              {formatBytes(pipeline.lastRunSummary.outputBytes)})
            </span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- ── Idle placeholder (never run this session) ── -->
    <div class="idle-content">
      <span class="idle-text">{UI_STRINGS.IDLE_READY}</span>
    </div>
  {/if}
</div>

<style lang="scss">
  .metrics-panel-row {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.6rem 1rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    flex-shrink: 0;
    min-height: 52px; /* reserve space so no layout jump */
  }

  /* ── Idle ── */
  .idle-content {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }

  .idle-text {
    font-size: 0.82rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  /* ── Last Run ── */
  .last-run-title {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .last-run-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
  }

  .last-run-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  /* ── Active ── */
  .progress-container-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .progress-bar-track {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-bar-fill {
    background: linear-gradient(90deg, var(--accent-color) 0%, var(--accent-hover) 100%);
    height: 100%;
    transition: width 0.2s ease-out;
  }
  .progress-labels-sub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .sub-metric-label {
    font-size: 0.8rem;
    color: var(--text-secondary);

    strong {
      color: var(--text-primary);
    }
  }

  .time-container-block {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.35rem;
    font-size: 0.8rem;
  }
  .total-time-title {
    color: var(--text-secondary);
    font-weight: 500;
  }
  .total-time-value {
    color: var(--metrics-time-color);
    font-weight: 700;
    font-family: monospace, system-ui;
    font-variant-numeric: tabular-nums;
    min-width: 125px;
    display: inline-block;
  }

  .intra-track {
    margin-top: 4px;
    height: 4px;
  }
  .intra-fill {
    background-color: var(--metrics-time-color);
  }
  .intra-row {
    gap: 1rem;
  }
  .intra-label {
    font-size: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80%;
  }
  .intra-value {
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .text-right {
    text-align: right;
  }
</style>
