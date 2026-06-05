<script lang="ts">
  import { pipeline } from '../stores/pipeline.svelte';
</script>

<div class="metrics-panel-row">
  <div class="progress-container-block">
    <div class="progress-bar-track">
      <div class="progress-bar-fill" style="width: {pipeline.overallProgress}%"></div>
    </div>
    <div class="progress-labels-sub-row">
      <span class="sub-metric-label"
        >Total Scanned: <strong>{pipeline.currentFileIndex}</strong> / {pipeline.totalFilesCount} file(s)</span
      >
      <span class="sub-metric-label text-right"
        >Overall Progress: <strong>{pipeline.overallProgress}%</strong></span
      >
    </div>
    {#if pipeline.currentFilename}
      <div class="progress-bar-track" style="margin-top: 4px; height: 4px;">
        <div
          class="progress-bar-fill"
          style="width: {pipeline.intraFileProgress}%; background-color: var(--metrics-time-color);"
        ></div>
      </div>
      <div class="progress-labels-sub-row" style="gap: 1rem;">
        <span
          class="sub-metric-label"
          style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;"
          title={pipeline.currentFilename}
        >
          Current File: <strong>{pipeline.currentFilename}</strong>
        </span>
        <span class="sub-metric-label text-right" style="font-size: 0.75rem; flex-shrink: 0;">
          <strong>{pipeline.intraFileProgress.toFixed(1)}%</strong>
        </span>
      </div>
    {/if}
  </div>
  <div class="time-container-block">
    <span class="total-time-title">Total Conversion Time:</span>
    <span class="total-time-value">{pipeline.runningTimeFormatted}</span>
  </div>
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
  }

  .progress-container-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .progress-bar-track {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
  }
  .progress-bar-fill {
    background-color: var(--accent-color);
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
    align-items: center;
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
  }
</style>
