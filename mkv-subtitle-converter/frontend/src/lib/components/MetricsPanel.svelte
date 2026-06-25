<script lang="ts">
  import { formatDuration } from '$lib/utils/formatters';

  interface Props {
    totalFiles: number;
    filesProcessed: number;
    filesSucceeded?: number;
    filesFailed?: number;
    filesSkipped?: number;
    filesNoTracks?: number;
    tracksConverted: number;
    progress: number; // 0-100
    elapsedSeconds: number;
    elapsedMs: number;
    status: string;
  }

  let {
    totalFiles,
    filesProcessed,
    filesSucceeded = 0,
    filesFailed = 0,
    filesSkipped = 0,
    filesNoTracks = 0,
    tracksConverted,
    progress,
    elapsedSeconds,
    elapsedMs,
    status
  }: Props = $props();

  const elapsed = $derived(
    elapsedSeconds > 0 || elapsedMs > 0 ? formatDuration(elapsedSeconds, elapsedMs) : '—'
  );

  const eta = $derived.by(() => {
    if (
      status !== 'processing' ||
      filesProcessed === 0 ||
      totalFiles === 0 ||
      filesProcessed === totalFiles
    ) {
      return '';
    }
    const elapsedTotSec = elapsedSeconds + elapsedMs / 1000;
    const timePerFile = elapsedTotSec / filesProcessed;
    const remainingFiles = totalFiles - filesProcessed;
    const remainingMs = Math.round(timePerFile * remainingFiles * 1000);

    const h = Math.floor(remainingMs / 3600000);
    const m = Math.floor((remainingMs % 3600000) / 60000);
    const s = Math.floor((remainingMs % 60000) / 1000);
    const ms = remainingMs % 1000;

    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    parts.push(`${ms}ms`);

    return `ETA: ${parts.join(' ')}`;
  });
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

{#if status === 'done' || status === 'cancelled'}
  <div class="metrics-grid breakdown-grid-4">
    <div class="metric-card">
      <span class="metric-label">Succeeded</span>
      <span class="metric-value success-text">{filesSucceeded}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Failed</span>
      <span class="metric-value danger-text">{filesFailed}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Skipped</span>
      <span class="metric-value secondary-text">{filesSkipped}</span>
    </div>
    <div class="metric-card" data-testid="no-tracks-metric">
      <span class="metric-label">No Tracks</span>
      <span class="metric-value secondary-text">{filesNoTracks}</span>
    </div>
  </div>
{/if}

{#if status === 'processing' || status === 'done' || status === 'cancelled'}
  <div class="progress-section">
    <div class="progress-label">
      <span>
        {status === 'processing' ? 'Processing…' : status === 'done' ? 'Complete' : 'Cancelled'}
        {#if eta}
          <span class="eta"> ({eta})</span>
        {/if}
      </span>
      <span>{Math.round(progress)}%</span>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        class:done={status === 'done'}
        class:cancelled={status === 'cancelled'}
        style:width="{progress}%"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin="0"
        aria-valuemax="100"
      ></div>
    </div>
  </div>
{/if}

<style lang="scss">
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 12px;

    @media (max-width: 680px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .breakdown-grid-4 {
    grid-template-columns: repeat(4, 1fr);
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

    &.success-text {
      color: #22c55e;
    }

    &.danger-text {
      color: var(--danger-color);
    }

    &.secondary-text {
      color: var(--text-secondary);
    }
  }

  .eta {
    color: var(--text-secondary);
    font-size: 0.8em;
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
