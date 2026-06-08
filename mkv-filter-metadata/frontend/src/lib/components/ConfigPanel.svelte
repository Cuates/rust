<script lang="ts">
  import { config, appState } from '../stores/config.svelte';
  import { pipeline } from '../stores/pipeline.svelte';

  $effect(() => {
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
            <option value="av1_videotoolbox">av1_videotoolbox (Apple)</option>
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
</style>
