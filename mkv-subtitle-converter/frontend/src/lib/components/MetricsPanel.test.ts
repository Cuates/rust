import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/svelte';
import MetricsPanel from './MetricsPanel.svelte';

vi.mock('$lib/utils/formatters', () => ({
  formatDuration: (s: number, ms: number = 0) => `${s}s ${ms}ms`
}));

describe('MetricsPanel Component', () => {
  it('renders all metrics correctly', () => {
    render(MetricsPanel, {
      props: {
        totalFiles: 10,
        filesProcessed: 5,
        tracksConverted: 12,
        progress: 50,
        elapsedSeconds: 15,
        elapsedMs: 500,
        status: 'processing'
      }
    });

    expect(screen.getByText('Files Found')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();

    expect(screen.getByText('Files Processed')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('Tracks Converted')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('Elapsed Time')).toBeInTheDocument();
    expect(screen.getByText('15s 500ms')).toBeInTheDocument();
  });

  it('renders progress bar and status when processing', () => {
    const { container } = render(MetricsPanel, {
      props: {
        totalFiles: 10,
        filesProcessed: 5,
        tracksConverted: 12,
        progress: 50,
        elapsedSeconds: 15,
        elapsedMs: 500,
        status: 'processing'
      }
    });

    expect(screen.getByText('Processing…')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Check if the progress fill element has the correct width style
    const fillElement = container.querySelector('.progress-fill') as HTMLElement;
    expect(fillElement).not.toBeNull();
    expect(fillElement.style.width).toBe('50%');
  });

  it('does not render progress bar when idle', () => {
    const { container } = render(MetricsPanel, {
      props: {
        totalFiles: 0,
        filesProcessed: 0,
        tracksConverted: 0,
        progress: 0,
        elapsedSeconds: 0,
        elapsedMs: 0,
        status: 'idle'
      }
    });

    expect(screen.queryByText('Processing…')).toBeNull();
    expect(container.querySelector('.progress-bar')).toBeNull();
  });

  it('renders correctly when status is done', () => {
    const { container } = render(MetricsPanel, {
      props: {
        totalFiles: 10,
        filesProcessed: 10,
        tracksConverted: 12,
        progress: 100,
        elapsedSeconds: 15,
        elapsedMs: 500,
        status: 'done'
      }
    });

    expect(screen.getByText('Complete')).toBeInTheDocument();
    const fillElement = container.querySelector('.progress-fill') as HTMLElement;
    expect(fillElement.classList.contains('done')).toBe(true);
  });

  it('renders correctly when status is cancelled', () => {
    const { container } = render(MetricsPanel, {
      props: {
        totalFiles: 10,
        filesProcessed: 5,
        tracksConverted: 6,
        progress: 50,
        elapsedSeconds: 15,
        elapsedMs: 500,
        status: 'cancelled'
      }
    });

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    const fillElement = container.querySelector('.progress-fill') as HTMLElement;
    expect(fillElement.classList.contains('cancelled')).toBe(true);
  });

  it('renders dashed elapsed time when no time has passed', () => {
    render(MetricsPanel, {
      props: {
        totalFiles: 0,
        filesProcessed: 0,
        tracksConverted: 0,
        progress: 0,
        elapsedSeconds: 0,
        elapsedMs: 0,
        status: 'idle'
      }
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
