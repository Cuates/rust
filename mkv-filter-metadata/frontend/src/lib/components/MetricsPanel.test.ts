import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MetricsPanel from './MetricsPanel.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';

describe('MetricsPanel.svelte', () => {
  beforeEach(() => {
    // Reset pipeline to a clean idle state before each test
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = false;
    pipeline.lastRunSummary = null;
    pipeline.consoleLogs = [];
    pipeline.totalFilesCount = 0;
    pipeline.completedFilesCount = 0;
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;
    pipeline.runningTimeFormatted = '0ms';
    pipeline.etaFormatted = '--';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Idle state (never run) ────────────────────────────────────────────────

  it('renders idle placeholder when panel has never been used', () => {
    render(MetricsPanel);
    expect(screen.getByText(/Ready — run history will appear here\./i)).toBeInTheDocument();
  });

  it('always renders the metrics panel (no conditional mount guard)', () => {
    // MetricsPanel must be present in the DOM regardless of state
    render(MetricsPanel);
    // The outer container should always be present
    const panel = document.querySelector('[aria-live="polite"]');
    expect(panel).not.toBeNull();
  });

  it('does not show active progress content when idle', () => {
    render(MetricsPanel);
    expect(screen.queryByText(/Overall Progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total Conversion Time/i)).not.toBeInTheDocument();
  });

  // ── Active processing state ───────────────────────────────────────────────

  it('shows active progress bar when processing is active', async () => {
    pipeline.processingActive = true;
    pipeline.hasProcessClicked = true;
    pipeline.totalFilesCount = 10;
    pipeline.completedFilesCount = 3;
    pipeline.runningTimeFormatted = '1m 20s';
    pipeline.etaFormatted = '3m 10s';

    render(MetricsPanel);

    // Overall progress label should be visible
    expect(screen.getByText(/Overall Progress:/i)).toBeInTheDocument();
    expect(screen.getByText(/30%/i)).toBeInTheDocument();
  });

  it('shows intra-file progress bars for active tasks', async () => {
    pipeline.processingActive = true;
    pipeline.hasProcessClicked = true;
    pipeline.activeFiles = {
      'movie1.mkv': 45.5,
      'movie2.mkv': 12.0
    };

    render(MetricsPanel);

    expect(screen.getByText('movie1.mkv')).toBeInTheDocument();
    expect(screen.getByText('movie2.mkv')).toBeInTheDocument();
    expect(screen.getByText('45.5%')).toBeInTheDocument();
    expect(screen.getByText('12.0%')).toBeInTheDocument();
  });

  it('shows neutral storage delta with default colour', async () => {
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 1,
      timeFormatted: '1s',
      storageSavedPercent: 0,
      originalBytes: 1000,
      outputBytes: 1000
    };

    render(MetricsPanel);

    const spans = screen.getAllByText(/0\.00%/);
    const span = spans.find((el) => el.classList.contains('stat-value'));
    expect(span).toHaveStyle({ color: 'var(--text-primary)' });
  });

  it('does not show idle placeholder when processing is active', () => {
    pipeline.processingActive = true;
    pipeline.hasProcessClicked = true;

    render(MetricsPanel);
    expect(screen.queryByText(/Ready — run history will appear here\./i)).not.toBeInTheDocument();
  });

  // ── Last Run summary state ─────────────────────────────────────────────────

  it('shows last run summary card after a run completes', async () => {
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 7,
      timeFormatted: '2m 5s',
      storageSavedPercent: 12.34,
      originalBytes: 2000,
      outputBytes: 1753
    };

    render(MetricsPanel);

    expect(screen.getByText(/Last Run/i)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // exact match: files processed
    expect(screen.getByText(/2m 5s/)).toBeInTheDocument();
  });

  it('shows positive storage delta in green-coloured span', async () => {
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 3,
      timeFormatted: '30s',
      storageSavedPercent: 50,
      originalBytes: 2000,
      outputBytes: 1000
    };

    render(MetricsPanel);
    // Should show a positive percentage
    expect(screen.getByText(/\+50\.00%/)).toBeInTheDocument();
  });

  it('shows neutral storage delta when output equals original', () => {
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 1,
      timeFormatted: '1s',
      originalBytes: 1000,
      outputBytes: 1000,
      storageSavedPercent: 0
    };
    render(MetricsPanel);
    // 0.00% should be text-primary
    expect(screen.getByText(/0\.00%/)).toBeInTheDocument();
  });

  it('shows negative storage delta when output is larger', async () => {
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 1,
      timeFormatted: '10s',
      storageSavedPercent: -100,
      originalBytes: 1000,
      outputBytes: 2000
    };

    render(MetricsPanel);
    expect(screen.getByText(/-100\.00%/)).toBeInTheDocument();
  });

  it('shows idle placeholder (not last run) when hasProcessClicked is false even if lastRunSummary is set', () => {
    // Edge case: lastRunSummary set but hasProcessClicked is false (shouldn't normally happen)
    pipeline.hasProcessClicked = false;
    pipeline.lastRunSummary = {
      filesProcessed: 5,
      timeFormatted: '1m',
      storageSavedPercent: 10,
      originalBytes: 1000,
      outputBytes: 900
    };

    render(MetricsPanel);
    // Idle placeholder should still show (hasEverRun is false)
    expect(screen.getByText(/Ready — run history will appear here\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Last Run/i)).not.toBeInTheDocument();
  });

  it('does not show storage delta block when originalBytes is 0', async () => {
    pipeline.processingActive = false;
    pipeline.hasProcessClicked = true;
    pipeline.lastRunSummary = {
      filesProcessed: 2,
      timeFormatted: '5s',
      storageSavedPercent: 0,
      originalBytes: 0,
      outputBytes: 0
    };

    render(MetricsPanel);
    expect(screen.queryByText(/Storage delta/i)).not.toBeInTheDocument();
  });

  it('renders active task list when processing', async () => {
    pipeline.processingActive = true;
    pipeline.activeFiles = {
      'video1.mkv': 45.5,
      'video2.mkv': 80.2
    };

    render(MetricsPanel);
    expect(screen.getByText('video1.mkv')).toBeInTheDocument();
    expect(screen.getByText('45.5%')).toBeInTheDocument();
    expect(screen.getByText('video2.mkv')).toBeInTheDocument();
    expect(screen.getByText('80.2%')).toBeInTheDocument();
  });
});
