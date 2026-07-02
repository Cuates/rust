<script lang="ts">
</script>

<svelte:head>
  <title>Guide - MKV Filter Metadata</title>
</svelte:head>

<main class="app-container">
  <header class="navbar-layer">
    <div style="display: flex; align-items: center; gap: 1rem;">
      <a class="back-btn" href="/" style="text-decoration: none;">←</a>
      <h1>How To Use</h1>
    </div>
  </header>

  <div class="content-scroll-area">
    <div class="form-workspace-card">
      <h2>Getting Started</h2>
      <p class="description">
        Learn how to easily add directories and configure your processing queue.
      </p>
      <ul class="guide-list">
        <li>
          <strong>Adding Directories:</strong> You can add directories to the processing queue by
          clicking the <span class="highlight">"+ Add Folder to Queue"</span> button on the main dashboard,
          or by simply dragging and dropping a folder from your operating system directly onto the application
          window.
        </li>
        <li>
          <strong>Managing the Queue:</strong> You can remove individual directories from the queue
          by clicking the red
          <span
            style="display: inline-flex; align-items: center; vertical-align: middle; padding: 0 0.15rem;"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--error-color, red)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
              ></line></svg
            ></span
          >
          icon next to them. Or, you can clear the entire queue at once by clicking the
          <span
            style="display: inline-flex; align-items: center; vertical-align: middle; padding: 0 0.15rem;"
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="3 6 5 6 21 6"></polyline><path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              ></path><line x1="10" y1="11" x2="10" y2="17"></line><line
                x1="14"
                y1="11"
                x2="14"
                y2="17"
              ></line></svg
            ></span
          > <span class="highlight">"Clear Entire Queue"</span> icon at the top of the queue list.
        </li>
        <li>
          <strong>Queue Persistence:</strong> By default, your queue is cleared when you close the
          application. If you'd like your queue to persist across reboots, you can enable the
          <span class="highlight">"Save Queue List Between Sessions"</span>
          option located in the
          <a href="/settings" class="guide-link">Settings (⚙️)</a> page.
        </li>
        <li>
          <strong>UI Theme Preferences:</strong> You can customize the application's appearance by
          selecting
          <span class="highlight">System</span>, <span class="highlight">Light</span>, or
          <span class="highlight">Dark</span>
          mode in the
          <a href="/settings" class="guide-link">Settings (⚙️)</a> page. By default, it actively follows
          your operating system's theme.
        </li>
      </ul>
    </div>

    <div class="form-workspace-card">
      <h2>Conversion Modes</h2>
      <p class="description">
        Understand the difference between the Remux and Re-encode processing modes.
      </p>
      <div class="mode-grid">
        <div class="mode-card">
          <h3>Remux (Stream Copy)</h3>
          <p><strong>Fast & Lossless</strong></p>
          <p class="text-sm">
            This mode is highly recommended if you only want to remove unwanted metadata, chapters,
            or subtitle tracks. It copies the original video and audio streams directly into a new
            file without altering their quality. Processing typically takes only a few seconds per
            file and requires minimal system resources.
          </p>
        </div>
        <div class="mode-card">
          <h3>Re-encode</h3>
          <p><strong>Slower & Resource Intensive</strong></p>
          <p class="text-sm">
            This mode actively shrinks video files by transcoding them into a more efficient format
            (like HEVC/H.265). It supports hardware acceleration (GPU) or software encoding (CPU).
            Because this mode re-calculates the video frames, it will take significantly longer and
            utilize a large percentage of your computer's processing power.
          </p>
        </div>
      </div>
    </div>

    <div class="form-workspace-card">
      <h2>Performance & Storage</h2>
      <p class="description">
        Learn how the application optimizes concurrency and system resources based on your hardware.
      </p>

      <h3 style="margin-top: 1rem;">Target Drive Type (SSD vs HDD)</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        You can configure the physical drive type where your files are being saved using the <strong
          >SSD / NVMe ⚡</strong
        >
        or <strong>HDD 💽</strong> toggle in the
        <a href="/settings" class="guide-link">Settings (⚙️)</a>. When <strong>HDD</strong> is
        selected, the application will automatically snap and clamp <strong>Remux</strong>
        concurrency to a maximum of 1. This prevents physical head thrashing that occurs when
        attempting to write multiple massive video streams simultaneously to a spinning disk.
        <strong>Re-encoding</strong> concurrency is fully decoupled from this setting and will still utilize
        the maximum limits of your hardware, as it is bottlenecked by the encoder rather than disk write
        speeds.
      </p>

      <h3 style="margin-top: 1.5rem;">Encoder-Aware Concurrency Limits</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        The Re-encode concurrency slider intelligently adapts to your chosen video codec. If you
        select a software encoder (like <strong>libx264</strong> or <strong>libx265</strong>), the
        slider is clamped to a maximum of 2 concurrent files. This is because these software
        encoders already heavily multi-thread across all your CPU cores internally to process a
        single file. Hardware encoders (like NVENC, AMF, or QSV) will allow higher concurrency
        limits based on your system hardware.
      </p>

      <h3 style="margin-top: 1.5rem;">Adaptive System Throttling</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        The application continuously monitors your global system resources. If your CPU usage spikes
        above 90% or your available memory falls below 15%, the processing pipeline will
        automatically pause spawning new tasks to prevent your computer from freezing. You will see
        a <span
          class="log-warning"
          style="display:inline; margin:0; font-weight:600; color:var(--warning-color);"
          >Yellow Toast</span
        >
        indicating the pause, followed by a
        <span
          class="log-success"
          style="display:inline; margin:0; font-weight:600; color:var(--success-color);"
          >Green Toast</span
        > once system resources have recovered and processing resumes.
      </p>
    </div>

    <div class="form-workspace-card">
      <h2>What to Expect</h2>
      <p class="description">
        How to interpret the feedback the application provides during processing.
      </p>

      <h3>Terminal Output Logs</h3>
      <ul class="guide-list log-legend">
        <li>
          <span class="log-success">🟢 Successes:</span> Indicates a file was successfully processed.
          You'll see the global metrics panel automatically update to show the total space saved or lost.
        </li>
        <li>
          <span class="log-warning">🟡 Warnings:</span> Indicates a file was skipped. This typically
          happens if the file has already been processed (contains the <code>[filtered]</code> tag), is
          in an unsupported format, or requires no changes.
        </li>
        <li>
          <span class="log-error">🔴 Errors:</span> Indicates a critical failure processing a specific
          file. This can be caused by file corruption, missing read/write permissions, or a hardware encoder
          crash. The application will log the error and attempt to seamlessly continue processing the
          rest of the queue.
        </li>
      </ul>

      <h3 style="margin-top: 1.5rem;">System Notifications</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        By default, the application will show a desktop system notification when your processing
        queue finishes. You can opt out of these by disabling the <span class="highlight"
          >"System Notifications"</span
        >
        toggle in the <a href="/settings" class="guide-link">Settings (⚙️)</a> page.
      </p>

      <h3 style="margin-top: 1.5rem;">Clear Processing History</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        The application keeps track of which files have already been processed to prevent redundant
        work. If you need to re-process files that were already completed in the past, you can click
        the <span class="highlight">"Clear Processing History"</span> button in the conversion panel
        or the <a href="/settings" class="guide-link">Settings (⚙️)</a> page (where you can also view
        the exact number of records stored). This resets the application's internal memory of completed
        files. Note: This does not affect your active directory queue list.
      </p>

      <h3 style="margin-top: 1.5rem;">Toast Notifications (Popups)</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        You will occasionally see small popup notifications appear at the bottom center of the
        screen. These <strong>Toast Messages</strong> are exclusively used for
        <em>global application events</em> (such as confirming your settings were saved, notifying you
        that stale/deleted directories were automatically removed from your queue, or confirming text
        was copied to your clipboard). They are distinct from the file-by-file progress logs shown in
        the terminal.
      </p>

      <h3 style="margin-top: 1.5rem;">Taskbar Progress Indicator</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        When the application is processing files, you can monitor the overall conversion progress
        directly from your operating system's <span class="highlight">taskbar</span> (or dock). This allows
        you to easily track the batch process without needing to keep the application window open or maximized.
        Once processing is complete, the indicator will automatically clear.
      </p>
      <ul
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-top: 0.5rem; padding-left: 1.5rem;"
      >
        <li style="margin-bottom: 0.25rem;">
          <strong>Windows:</strong> The application's taskbar icon will fill up horizontally with a green
          progress overlay (or your system's accent color).
        </li>
        <li style="margin-bottom: 0.25rem;">
          <strong>macOS:</strong> A distinct horizontal progress bar will appear along the bottom edge
          of the application icon in the Dock.
        </li>
        <li style="margin-bottom: 0.25rem;">
          <strong>Linux:</strong> On supported desktop environments (such as GNOME or Unity), a progress
          overlay will be displayed over the application's dock icon.
        </li>
      </ul>
    </div>
  </div>
</main>

<style lang="scss">
  .app-container {
    box-sizing: border-box;
    max-width: 850px;
    height: 100vh;
    margin: 0 auto;
    padding: 0 1rem 0 1rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .content-scroll-area {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1rem;
    padding-right: 0.5rem;
    margin-right: -0.5rem;
  }

  .navbar-layer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-color);
    padding: 1rem 0 0.5rem 0;
    margin-bottom: 1rem;
    flex-shrink: 0;

    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }
  }

  .back-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: var(--accent-color);
    }
  }

  .form-workspace-card {
    background-color: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    h2 {
      font-size: 1.1rem;
      margin-top: 0;
      margin-bottom: 0.25rem;
      color: var(--text-primary);
    }

    h3 {
      font-size: 1rem;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
      color: var(--text-primary);
    }

    .description {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0;
      margin-bottom: 1.25rem;
      line-height: 1.4;
    }
  }

  .guide-list {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.9rem;
    color: var(--text-primary);
    line-height: 1.6;

    li {
      margin-bottom: 0.75rem;
      &::marker {
        color: var(--accent-color);
      }
    }
  }

  .highlight {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
  }

  .guide-link {
    color: var(--accent-color);
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }

  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  }

  .mode-card {
    background-color: var(--bg-canvas);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 1rem;

    h3 {
      margin-top: 0;
      margin-bottom: 0.25rem;
      font-size: 1.05rem;
    }

    p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .text-sm {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-top: 0.75rem;
      line-height: 1.5;
    }
  }

  .log-legend {
    list-style-type: none;
    padding-left: 0;

    li {
      margin-bottom: 1rem;
      padding-left: 1rem;
      border-left: 3px solid transparent;

      code {
        background-color: var(--bg-canvas);
        border: 1px solid var(--border-color);
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
      }
    }

    .log-success {
      color: var(--success-color);
      font-weight: 600;
      display: block;
      margin-bottom: 0.25rem;
    }

    .log-warning {
      color: var(--warning-color);
      font-weight: 600;
      display: block;
      margin-bottom: 0.25rem;
    }

    .log-error {
      color: var(--error-color);
      font-weight: 600;
      display: block;
      margin-bottom: 0.25rem;
    }
  }

  /* Specific border colors for legend */
  .log-legend li:nth-child(1) {
    border-left-color: var(--success-color);
  }
  .log-legend li:nth-child(2) {
    border-left-color: var(--warning-color);
  }
  .log-legend li:nth-child(3) {
    border-left-color: var(--error-color);
  }
</style>
