<script lang="ts">
  import { config, appState } from '../stores/config.svelte';
  import { pipeline } from '../stores/pipeline.svelte';

  let { onclearhistory }: { onclearhistory?: () => void } = $props();

  $effect(() => {
    // Clamp concurrency for software codecs
    if (config.video_codec === 'libx264' || config.video_codec === 'libx265') {
      if (config.reencode_concurrency > 2) config.reencode_concurrency = 2;
    }

    // Reactively update the preset if the current preset is incompatible with the new video_codec
    if (config.video_codec.includes('nvenc') && !config.preset.match(/^p[1-7]$/)) {
      config.preset = 'p4';
    } else if (
      config.video_codec.includes('amf') &&
      !['speed', 'balanced', 'quality'].includes(config.preset)
    ) {
      config.preset = 'balanced';
    } else if (config.video_codec.includes('videotoolbox') && config.preset !== 'default') {
      config.preset = 'default';
    } else if (
      !config.video_codec.includes('nvenc') &&
      !config.video_codec.includes('amf') &&
      !config.video_codec.includes('videotoolbox') &&
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
</script>

<div class="grid-layout-2">
  <div class="row">
    <label for="conv-mode">Conversion Mode</label>
    <select id="conv-mode" bind:value={config.conversion_mode} disabled={pipeline.processingActive}>
      <option value="remux">Remux (Stream Copy)</option>
      <option value="reencode">Reencode Processing</option>
    </select>
  </div>
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
</div>

<div class="grid-layout-2">
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

<div class="grid-layout-1" style="margin-bottom: 0.5rem;">
  <div class="row toggle-row">
    <label for="recursive-scan" class="toggle-label">Recursive Directory Scanning</label>
    <label class="switch">
      <input
        id="recursive-scan"
        type="checkbox"
        bind:checked={config.recursive}
        disabled={pipeline.processingActive}
      />
      <span class="slider round"></span>
    </label>
  </div>
</div>

<div class="advanced-wrapper" class:expanded={config.conversion_mode === 'reencode'}>
  <div class="reencode-advanced-panel">
    <div class="grid-layout-3">
      <div class="row">
        <label for="v-codec">Video Encoder</label>
        <select id="v-codec" bind:value={config.video_codec} disabled={pipeline.processingActive}>
          <option value="libx265">libx265 (CPU)</option>
          <option value="libx264">libx264 (CPU)</option>
          {#if appState.hardwareEncoders.nvenc}
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
      <div class="row">
        <label for="crf-val">CRF (0-51)</label>
        <input
          id="crf-val"
          type="number"
          bind:value={config.crf}
          min="0"
          max="51"
          autocomplete="off"
          disabled={pipeline.processingActive}
        />
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
  .grid-layout-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .grid-layout-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }
  }

  .toggle-row {
    flex-direction: row;
    align-items: center;
    gap: 1rem;

    .toggle-label {
      margin: 0;
    }
  }

  /* Toggle Switch Styles */
  .switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--border-color);
    transition: 0.4s;
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--accent-color);
  }

  input:disabled + .slider {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input:checked + .slider:before {
    transform: translateX(16px);
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

    &:focus:not(:disabled) {
      border-color: var(--accent-color);
    }
  }

  /* Collapsible Settings Implementation */
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
    border-top: 1px solid var(--border-color);
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
    transition: all 0.2s;
    width: fit-content;

    &:hover:not(:disabled) {
      color: var(--error-color, #ff4c4c);
      border-color: var(--error-color, #ff4c4c);
    }
  }
</style>
