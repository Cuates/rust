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

  it('disables inputs when pipeline is active', () => {
    pipeline.processingActive = true;
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const convMode = screen.getByLabelText(/Conversion Mode/i);
    expect(convMode).toBeDisabled();

    const outExt = screen.getByLabelText(/Output Extension/i);
    expect(outExt).toBeDisabled();
  });

  it('reacts to video_codec changes and updates preset for nvenc', async () => {
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const codecSelect = screen.getByLabelText(/Video Encoder/i);
    await fireEvent.change(codecSelect, { target: { value: 'hevc_nvenc' } });

    expect(config.video_codec).toBe('hevc_nvenc');
    expect(config.preset).toBe('p4'); // since 'medium' is incompatible
  });

  it('reacts to video_codec changes and updates preset for amf', async () => {
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const codecSelect = screen.getByLabelText(/Video Encoder/i);
    await fireEvent.change(codecSelect, { target: { value: 'hevc_amf' } });

    expect(config.video_codec).toBe('hevc_amf');
    expect(config.preset).toBe('balanced');
  });

  it('reacts to video_codec changes and updates preset for videotoolbox', async () => {
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const codecSelect = screen.getByLabelText(/Video Encoder/i);
    await fireEvent.change(codecSelect, { target: { value: 'hevc_videotoolbox' } });

    expect(config.video_codec).toBe('hevc_videotoolbox');
    expect(config.preset).toBe('default');
  });

  it('reacts to video_codec changes and updates preset for CPU (libx264)', async () => {
    config.video_codec = 'hevc_nvenc';
    config.preset = 'p1';
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const codecSelect = screen.getByLabelText(/Video Encoder/i);
    await fireEvent.change(codecSelect, { target: { value: 'libx264' } });

    expect(config.video_codec).toBe('libx264');
    expect(config.preset).toBe('faster'); // fallback for incompatible CPU preset
  });

  it('caps reencode_concurrency to 2 for software codecs', async () => {
    config.video_codec = 'hevc_nvenc';
    config.reencode_concurrency = 4;
    render(ConfigPanel, { props: { onclearhistory: vi.fn() } });

    const codecSelect = screen.getByLabelText(/Video Encoder/i);
    await fireEvent.change(codecSelect, { target: { value: 'libx265' } });

    expect(config.video_codec).toBe('libx265');
    expect(config.reencode_concurrency).toBe(2);
  });

  it('calls onclearhistory when clear history button is clicked', async () => {
    const onclearhistory = vi.fn();
    render(ConfigPanel, { props: { onclearhistory } });

    const btn = screen.getByText(/Clear Processing History/i);
    await fireEvent.click(btn);

    expect(onclearhistory).toHaveBeenCalled();
  });
});
