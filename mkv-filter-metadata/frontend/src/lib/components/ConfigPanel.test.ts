import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ConfigPanel from './ConfigPanel.svelte';
import { config, appState } from '$lib/stores/config.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';

describe('ConfigPanel.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.conversion_mode = 'reencode';
    config.video_codec = 'libx264';
    config.preset = 'medium';
    config.reencode_concurrency = 2;
    pipeline.processingActive = false;
    appState.hardwareEncoders = {
      nvenc: true,
      amf: true,
      qsv: true,
      videotoolbox: true
    };
  });

  it('renders all inputs correctly', () => {
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });
    expect(screen.getByLabelText(/Conversion Mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Output Extension/i)).toBeInTheDocument();
  });

  it('updates conversion mode on mode card click', async () => {
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });
    const remuxBtn = screen.getByText('Remux').closest('button');
    await fireEvent.click(remuxBtn!);
    expect(config.conversion_mode).toBe('remux');
  });

  it('disables inputs when pipeline is active', () => {
    pipeline.processingActive = true;
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    // Conversion mode toggle cards should be disabled when processing is active
    const remuxBtn = screen.getByText('Remux').closest('button');
    expect(remuxBtn).toBeDisabled();

    const reencodeBtn = screen.getByText('Re-encode').closest('button');
    expect(reencodeBtn).toBeDisabled();

    const outExt = screen.getByLabelText(/Output Extension/i);
    expect(outExt).toBeDisabled();
  });

  it('calls onclearhistory when clear history button is clicked', async () => {
    const onclearhistory = vi.fn();
    render(ConfigPanel, { props: { onclearhistory } });

    const btn = screen.getByText(/Clear Processing History/i);
    await fireEvent.click(btn);

    expect(onclearhistory).toHaveBeenCalled();
  });

  it('renders different presets based on video_codec', async () => {
    config.video_codec = 'hevc_nvenc';
    const { unmount: u1 } = render(ConfigPanel);
    expect(screen.getByText('p1 (Fastest)')).toBeInTheDocument();
    u1();

    config.video_codec = 'hevc_amf';
    const { unmount: u2 } = render(ConfigPanel);
    expect(screen.getByText('speed')).toBeInTheDocument();
    u2();

    config.video_codec = 'hevc_videotoolbox';
    const { unmount: u3 } = render(ConfigPanel);
    expect(screen.getByText('default')).toBeInTheDocument();
    u3();
  });

  it('renders hardware encoder options if supported', async () => {
    const { appState } = await import('../../lib/stores/config.svelte');
    appState.hardwareEncoders = { nvenc: true, qsv: true, amf: true, videotoolbox: true };
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const reencodeBtn = screen.getByText('Re-encode').closest('button');
    await fireEvent.click(reencodeBtn!);

    expect(screen.getByText(/hevc_nvenc/i)).toBeInTheDocument();
    expect(screen.getByText(/hevc_qsv/i)).toBeInTheDocument();
    expect(screen.getByText(/hevc_amf/i)).toBeInTheDocument();
    expect(screen.getByText(/hevc_videotoolbox/i)).toBeInTheDocument();
  });
});
