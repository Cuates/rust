import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MetricsPanel from './MetricsPanel.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';
import { tick } from 'svelte';

describe('MetricsPanel.svelte', () => {
  beforeEach(() => {
    pipeline.totalFilesCount = 0;
    pipeline.completedFilesCount = 0;
    pipeline.activeFiles = {};
    pipeline.runningTimeFormatted = '0ms';
    pipeline.etaFormatted = '0ms';
    pipeline.processingActive = false;
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;
  });

  it('renders overall metrics correctly', () => {
    pipeline.totalFilesCount = 5;
    pipeline.completedFilesCount = 2;
    pipeline.activeFiles = { 'video1.mkv': 50 }; // completed = 2 + 0.5 = 2.5/5 = 50%

    render(MetricsPanel);

    expect(screen.getByText(/Total Scanned:/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // completed (2) + active (1) = 3
    expect(screen.getByText(/5 file\(s\)/)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders active tasks correctly', () => {
    pipeline.activeFiles = {
      'video1.mkv': 33.33,
      'video2.mkv': 66.66
    };

    render(MetricsPanel);

    expect(screen.getByText('video1.mkv')).toBeInTheDocument();
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getByText('video2.mkv')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('renders time metrics', () => {
    pipeline.runningTimeFormatted = '1m 20s';
    render(MetricsPanel);
    expect(screen.getByText('1m 20s')).toBeInTheDocument();

    // ETA should not be visible when processing is inactive
    expect(screen.queryByText('ETA:')).not.toBeInTheDocument();
  });

  it('renders ETA when processing is active', () => {
    pipeline.processingActive = true;
    pipeline.etaFormatted = '5m 10s';
    render(MetricsPanel);
    expect(screen.getByText('ETA:')).toBeInTheDocument();
    expect(screen.getByText('5m 10s')).toBeInTheDocument();
  });

  it('renders storage saved when progress is 100% and original bytes > 0', () => {
    pipeline.totalFilesCount = 1;
    pipeline.completedFilesCount = 1; // 100%
    pipeline.storageOriginalBytes = 2000;
    pipeline.storageOutputBytes = 1000;

    render(MetricsPanel);
    expect(screen.getByText('Storage Saved:')).toBeInTheDocument();
    // (2000 - 1000) / 2000 * 100 = 50.00%
    expect(screen.getByText(/50.00%/)).toBeInTheDocument();
  });

  it('does not render storage saved when original bytes is 0', () => {
    pipeline.totalFilesCount = 1;
    pipeline.completedFilesCount = 1; // 100%
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;

    render(MetricsPanel);
    expect(screen.queryByText('Storage Saved:')).not.toBeInTheDocument();
  });

  it('renders negative storage saved correctly (increased size)', () => {
    pipeline.totalFilesCount = 1;
    pipeline.completedFilesCount = 1; // 100%
    pipeline.storageOriginalBytes = 1000;
    pipeline.storageOutputBytes = 2000; // Increased size

    render(MetricsPanel);
    expect(screen.getByText('Storage Saved:')).toBeInTheDocument();
    expect(screen.getByText(/-100.00%/)).toBeInTheDocument();
  });

  it('renders zero storage saved correctly (unchanged size)', () => {
    pipeline.totalFilesCount = 1;
    pipeline.completedFilesCount = 1; // 100%
    pipeline.storageOriginalBytes = 1000;
    pipeline.storageOutputBytes = 1000; // No change

    render(MetricsPanel);
    expect(screen.getByText('Storage Saved:')).toBeInTheDocument();
    expect(screen.getByText(/0.00%/)).toBeInTheDocument();
  });

  it('updates reactively when pipeline state changes', async () => {
    // Initial state: empty active files, 0 progress
    pipeline.totalFilesCount = 2;
    pipeline.completedFilesCount = 0;
    pipeline.storageOriginalBytes = 0;
    pipeline.storageOutputBytes = 0;

    render(MetricsPanel);

    // Assert initial state
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('video1.mkv')).not.toBeInTheDocument();
    expect(screen.queryByText('Storage Saved:')).not.toBeInTheDocument();

    // Update state to trigger reactivity (adding an active file)
    pipeline.activeFiles = { 'video1.mkv': 50 };
    await tick();

    // Assert updated state
    expect(screen.getByText('video1.mkv')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();

    // Update state to trigger storage saved section
    pipeline.completedFilesCount = 2; // 100% overall progress
    pipeline.activeFiles = {};
    pipeline.storageOriginalBytes = 2000;
    pipeline.storageOutputBytes = 1000;
    await tick();

    // Assert storage saved section appeared
    expect(screen.getByText('Storage Saved:')).toBeInTheDocument();
    expect(screen.getByText(/50.00%/)).toBeInTheDocument();

    // Update to negative storage saved
    pipeline.storageOutputBytes = 3000;
    await tick();

    expect(screen.getByText(/-50.00%/)).toBeInTheDocument();
  });
});
