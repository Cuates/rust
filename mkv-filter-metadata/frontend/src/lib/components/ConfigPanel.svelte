<script lang="ts">
  import { config, appState } from '../stores/config.svelte';
  import { pipeline } from '../stores/pipeline.svelte';

  let { onclearhistory }: { onclearhistory?: () => void } = $props();

  /*
  $effect(() => {
    const codec = config.video_codec;
    untrack(() => {
      // Clamp concurrency for software codecs
      if (codec === 'libx264' || codec === 'libx265') {
        if (config.reencode_concurrency > 2) config.reencode_concurrency = 2;
      }

      // Reactively update the preset if the current preset is incompatible with the new video_codec
      if (codec.includes('nvenc') && !config.preset.match(/^p[1-7]$/)) {
        config.preset = 'p4';
      } else if (
        codec.includes('amf') &&
        !['speed', 'balanced', 'quality'].includes(config.preset)
      ) {
        config.preset = 'balanced';
      } else if (codec.includes('videotoolbox') && config.preset !== 'default') {
        config.preset = 'default';
      } else if (
        !codec.includes('nvenc') &&
        !codec.includes('amf') &&
        !codec.includes('videotoolbox') &&
        ![
          'ultrafast',
          'superfast',
          'veryfast',
          'faster',
          'fast',
          'medium',
          'slow',
          'slower',
          'veryslow'
        ].includes(config.preset)
      ) {
        config.preset = 'faster';
      }
    });
  });
  */

  const conversionModes = [
    { value: 'remux' as const, label: 'Remux', desc: 'Fast container swap, no re-encode' },
    { value: 'reencode' as const, label: 'Re-encode', desc: 'Full transcode, smaller file' }
  ];
</script>

<!-- Conversion Mode: toggle cards instead of a plain <select> -->
<div
  class="mode-toggle-group"
  role="radiogroup"
  aria-label="Conversion mode"
  style="margin-bottom: 0.75rem;"
>
  {#each conversionModes as mode (mode.value)}
    <button
      class="mode-card"
      class:active={config.conversion_mode === mode.value}
      onclick={() => (config.conversion_mode = mode.value)}
      disabled={pipeline.processingActive}
      role="radio"
      aria-checked={config.conversion_mode === mode.value}
    >
      <span class="mode-card-label">{mode.label}</span>
      <span class="mode-card-desc">{mode.desc}</span>
    </button>
  {/each}
</div>

<div class="grid-layout-2" style="container-type: inline-size;">
  <div class="row">
    <label for="out-ext">Output Extension</label>
    <input
      id="out-ext"
      bind:value={config.output_extension}
      placeholder=".mkv"
      autocomplete="off"
      disabled={pipeline.processingActive}
    />
  </div>
  <div class="row">
    <label for="exts">File Extensions Filter</label>
    <input
      id="exts"
      bind:value={config.file_extensions}
      placeholder="mkv, mp4, mov, avi, ogm, wmv"
      autocomplete="off"
      disabled={pipeline.processingActive}
    />
  </div>
</div>

<div class="grid-layout-1">
  <div class="row">
    <label for="subs">Subtitle Tracks to Keep</label>
    <input
      id="subs"
      bind:value={config.subtitle_tracks}
      placeholder="ang, eng, enm, zxx, und"
      autocomplete="off"
      disabled={pipeline.processingActive}
    />
  </div>
</div>

<div class="advanced-wrapper" class:expanded={config.conversion_mode === 'reencode'}>
  <div class="reencode-advanced-panel">
    <div class="grid-layout-2" style="container-type: inline-size;">
      <div class="row">
        <label for="v-codec">Video Encoder</label>
        <select id="v-codec" bind:value={config.video_codec} disabled={pipeline.processingActive}>
          <option value="libx265">libx265 (CPU)</option>
          <option value="libx264">libx264 (CPU)</option>
          {#if appState /* v8 ignore next 25 */.hardwareEncoders.nvenc}
            <option value="hevc_nvenc">hevc_nvenc (NVIDIA)</option>
            <option value="h264_nvenc">h264_nvenc (NVIDIA)</option>
            <option value="av1_nvenc">av1_nvenc (NVIDIA)</option>
          {/if}
          {#if appState.hardwareEncoders.amf}
            <option value="hevc_amf">hevc_amf (AMD)</option>
            <option value="h264_amf">h264_amf (AMD)</option>
            <option value="av1_amf">av1_amf (AMD)</option>
          {/if}
          {#if appState.hardwareEncoders.videotoolbox}
            <option value="hevc_videotoolbox">hevc_videotoolbox (Apple)</option>
            <option value="h264_videotoolbox">h264_videotoolbox (Apple)</option>
          {/if}
          {#if appState.hardwareEncoders.qsv}
            <option value="hevc_qsv">hevc_qsv (Intel)</option>
            <option value="h264_qsv">h264_qsv (Intel)</option>
            <option value="av1_qsv">av1_qsv (Intel)</option>
          {/if}
        </select>
      </div>
      <div class="row">
        <label for="preset-val">Encoder Preset</label>
        <select
          id="preset-val"
          bind:value={config.preset}
          disabled={pipeline.processingActive || config.video_codec.includes('videotoolbox')}
        >
          {#if config.video_codec.includes('nvenc')}
            <option value="p1">p1 (Fastest)</option>
            <option value="p2">p2</option>
            <option value="p3">p3</option>
            <option value="p4">p4 (Medium)</option>
            <option value="p5">p5</option>
            <option value="p6">p6</option>
            <option value="p7">p7 (Slowest)</option>
          {:else if config.video_codec.includes('amf')}
            <option value="speed">speed</option>
            <option value="balanced">balanced</option>
            <option value="quality">quality</option>
          {:else if config.video_codec.includes('videotoolbox')}
            <option value="default">default</option>
          {:else}
            <option value="ultrafast">ultrafast</option>
            <option value="superfast">superfast</option>
            <option value="veryfast">veryfast</option>
            <option value="faster">faster</option>
            <option value="fast">fast</option>
            <option value="medium">medium</option>
            <option value="slow">slow</option>
            <option value="slower">slower</option>
            <option value="veryslow">veryslow</option>
          {/if}
        </select>
      </div>
    </div>

    <!-- CRF: slider + number input in sync, with semantic anchor labels -->
    <div class="crf-row">
      <label for="crf-val">CRF (0–51)</label>
      <div class="crf-control-group">
        <input
          id="crf-val"
          class="crf-number"
          type="number"
          bind:value={config.crf}
          min="0"
          max="51"
          autocomplete="off"
          disabled={pipeline.processingActive}
        />
        <div class="slider-wrapper">
          <input
            class="crf-slider"
            type="range"
            bind:value={config.crf}
            min="0"
            max="51"
            step="1"
            disabled={pipeline.processingActive}
            aria-label="CRF slider"
          />
          <div class="crf-anchors" aria-hidden="true">
            <span class="crf-anchor anchor-left" class:active={config.crf < 12}> lossless </span>
            <span
              class="crf-anchor anchor-center"
              class:active={config.crf >= 12 && config.crf <= 38}
            >
              balanced
            </span>
            <span class="crf-anchor anchor-right" class:active={config.crf > 38}> compressed </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="grid-layout-1" style="margin-top: 1rem;">
  <div class="row">
    <button class="clear-history-btn" onclick={onclearhistory} disabled={pipeline.processingActive}>
      Clear Processing History
    </button>
  </div>
</div>

<style lang="scss">
  /* Container query: internal grid reflows based on ConfigPanel's own width,
     independent of how many outer columns exist. Threshold 340px is below the
     minimum left-pane width at Tier 2 (800px breakpoint → ~304px), ensuring
     the single-column reflow fires before the two-column grid overflows. */
  .grid-layout-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.5rem;

    @container (max-width: 340px) {
      grid-template-columns: 1fr;
    }
  }
  .grid-layout-1 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  input,
  select {
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.15s;
    width: 100%;
    min-width: 0;

    &:focus:not(:disabled) {
      border-color: var(--accent-color);
    }
  }

  .mode-toggle-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;

    @container (max-width: 360px) {
      grid-template-columns: 1fr;
    }
  }

  .mode-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    padding: 0.6rem 0.85rem;
    border-radius: 8px;
    border: 2px solid var(--border-color);
    background-color: var(--bg-canvas);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    width: 100%;

    &:hover:not(:disabled) {
      border-color: var(--accent-color);
      background-color: var(--bg-hover-panel);
    }

    &.active {
      border-color: var(--accent-color);
      background-color: color-mix(in srgb, var(--accent-color) 12%, transparent);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .mode-card-label {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .mode-card-desc {
    font-size: 0.78rem;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  /* ─── CRF slider with semantic anchor labels ─── */
  .crf-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .crf-control-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .crf-number {
    width: 64px;
    flex-shrink: 0;
    text-align: center;
  }

  .slider-wrapper {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .crf-slider {
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    accent-color: var(--accent-color);
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .crf-anchors {
    position: relative;
    height: 1.2em;
    margin-top: 0.1rem;
  }

  .crf-anchor {
    position: absolute;
    font-size: 0.72rem;
    color: var(--text-secondary);
    white-space: nowrap;
    transition: color 0.15s;

    &.active {
      color: var(--accent-color);
      font-weight: 600;
    }
  }

  .anchor-left {
    left: 0;
  }

  .anchor-center {
    left: 50%;
    transform: translateX(-50%);
  }

  .anchor-right {
    right: 0;
  }

  /* ─── Collapsible Re-encode Settings ─── */
  .advanced-wrapper {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.25s ease-out;
    overflow: hidden;

    &.expanded {
      grid-template-rows: 1fr;
    }
  }
  .reencode-advanced-panel {
    min-height: 0;
    padding-top: 0.5rem;
  }

  .clear-history-btn {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease,
      opacity 0.2s ease;
    width: fit-content;

    &:hover:not(:disabled) {
      color: var(--error-color, #ff4c4c);
      border-color: var(--error-color, #ff4c4c);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
</style>
