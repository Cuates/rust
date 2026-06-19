<script lang="ts">
  import { formatDuration } from '$lib/utils/formatters';

  interface Props {
    totalFiles: number;
    filesProcessed: number;
    tracksConverted: number;
    progress: number; // 0-100
    elapsedSeconds: number;
    elapsedMs: number;
    status: string;
  }

  let {
    totalFiles,
    filesProcessed,
    tracksConverted,
    progress,
    elapsedSeconds,
    elapsedMs,
    status
  }: Props = $props();

  const elapsed = $derived(
    elapsedSeconds > 0 || elapsedMs > 0 ? formatDuration(elapsedSeconds, elapsedMs) : '—'
  );
</script>

<div class="metrics-grid">
  <div class="metric-card">
    <span class="metric-label">Files Found</span>
    <span class="metric-value">{totalFiles}</span>
  </div>

  <div class="metric-card">
    <span class="metric-label">Files Processed</span>
    <span class="metric-value">{filesProcessed}</span>
  </div>

  <div class="metric-card">
    <span class="metric-label">Tracks Converted</span>
    <span class="metric-value accent">{tracksConverted}</span>
  </div>

  <div class="metric-card">
    <span class="metric-label">Elapsed Time</span>
    <span
      class="metric-value elapsed"
      class:long={elapsed.length > 9}
      class:very-long={elapsed.length > 13}>{elapsed}</span
    >
  </div>
</div>

{#if status === 'processing' || status === 'done' || status === 'cancelled'}
  <div class="progress-section">
    <div class="progress-label">
      <span
        >{status === 'processing'
          ? 'Processing…'
          : status === 'done'
            ? 'Complete'
            : 'Cancelled'}</span
      >
      <span>{Math.round(progress)}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        class:done={status === 'done'}
        class:cancelled={status === 'cancelled'}
        style:width="{progress}%"
      ></div>
    </div>
  </div>
{/if}

<style lang="scss">
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 16px;

    @media (max-width: 680px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .metric-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--accent-color);
    }
  }

  .metric-label {
    font-size: 0.72rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .metric-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;

    &.accent {
      color: var(--accent-color);
    }

    &.elapsed {
      transition: font-size 0.2s ease;
      white-space: nowrap;

      &.long {
        font-size: 1.3rem;
      }

      &.very-long {
        font-size: 1.15rem;
      }
    }
  }

  .progress-section {
    margin-bottom: 16px;
  }

  .progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .progress-bar {
    height: 6px;
    background: var(--bg-surface);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .progress-fill {
    height: 100%;
    background: var(--accent-color);
    border-radius: 3px;
    transition: width 0.3s ease-out;

    &.done {
      background: #22c55e;
    }

    &.cancelled {
      background: var(--danger-color);
    }
  }
</style>
