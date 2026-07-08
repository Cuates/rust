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
          <strong>Queue Details & Tooltips:</strong> Each directory in your target processing queue
          is displayed using a modern <strong>pill shape</strong> layout. The first line features
          icons alongside the base folder name, while the second line houses data pills showing the
          total number of files inside and their combined size. It also includes interactive state
          pills that react during processing. To keep the interface clean, long paths and text are
          truncated; simply hover your mouse over these items (or the folder icon) to reveal a
          <strong>custom tooltip</strong> containing the full details. You can also drag and drop the
          rows to re-order the queue priority.
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
          > <span class="highlight">"Clear Entire Queue"</span> icon at the top of the queue list. When
          files are skipped due to existing history, the interactive state pills will visually update
          to reflect this. Triggering a "Clear History" resets these interactive pills, making them active
          for re-processing. Additionally, if you intentionally abort or stop the processing queue mid-way
          through, any un-processed interactive pills will immediately halt and visually reflect their
          stopped state.
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
      <h2>Settings & Advanced Features</h2>
      <p class="description">
        Supercharge your workflow using the Command Palette, custom shortcuts, and reusable presets.
      </p>

      <h3 style="margin-top: 1rem;">Command Palette & Keyboard Shortcuts</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;"
      >
        Navigate the application at lightning speed without taking your hands off the keyboard:
      </p>
      <ol class="guide-list" style="list-style-type: decimal; padding-left: 2rem;">
        <li>
          Press <strong>Ctrl+K</strong> from anywhere in the application to open the
          <strong>Command Palette</strong>.
        </li>
        <li>
          Type a command (like "Settings", "Guide", or "Clear History") and hit <strong
            >Enter</strong
          > to instantly execute it.
        </li>
        <li>
          You can configure custom keyboard shortcuts for starting or aborting the processing queue.
          To do this, open the <strong>Settings (⚙️)</strong> page, click on a shortcut input field, and
          press your desired key combination on your keyboard.
        </li>
      </ol>

      <h3 style="margin-top: 1.5rem;">User Presets</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;"
      >
        If you find yourself using the same video encoder and configuration frequently, you can save
        them as a custom preset:
      </p>
      <ol class="guide-list" style="list-style-type: decimal; padding-left: 2rem;">
        <li>
          Configure your desired conversion mode, codec, and parameters on the main dashboard.
        </li>
        <li>
          Open the <strong>Settings (⚙️)</strong> page and locate the
          <strong>Configuration Presets</strong> section.
        </li>
        <li>
          Type a name for your preset in the input box and click the <strong>Save Preset</strong> button.
        </li>
        <li>
          Your preset will appear in the list below. You can click <strong>Apply</strong> to instantly
          restore those settings in the future, or the red trash icon to delete it.
        </li>
      </ol>
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

      <h3 style="margin-top: 1rem;">Parallel Processing</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        The application is designed to process multiple video files in <strong>parallel</strong> simultaneously,
        drastically reducing the total time required for large batches. The system implements a smooth
        staggered start (eliminating "thunder herding"), ensuring that even with high concurrency settings,
        your hardware is ramped up gently rather than being hit with all tasks at the exact same millisecond.
        The total number of files processed at once depends on your hardware and settings.
      </p>

      <h3 style="margin-top: 1.5rem;">Target Drive Type (SSD vs HDD)</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        You can configure the physical drive type where your files are being saved using the <strong
          >SSD / NVMe ⚡</strong
        >
        or <strong>HDD 💽</strong> toggle in the
        <a href="/settings" class="guide-link">Settings (⚙️)</a>. To prevent physical hardware
        thrashing and IO bottlenecks, the application will automatically snap and clamp
        <strong>Remux</strong>
        concurrency to a maximum of <strong>2</strong> for SSDs, and a maximum of <strong>1</strong>
        for HDDs.
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
        indicating that the system is congested. During this state, the visual queue and terminal will
        appear paused, holding new items in a waiting state until it is safe to proceed. Once system resources
        have recovered to acceptable levels, you will receive a
        <span
          class="log-success"
          style="display:inline; margin:0; font-weight:600; color:var(--success-color);"
          >Green Toast</span
        >
        confirming that the pipeline has resumed.
        <em
          >Note: When a batch begins, the System Guard employs a brief 1.5-second grace period to
          allow the application's underlying async workers to initialize. This eliminates
          false-positive congestion warnings caused by normal application spin-up spikes.</em
        >
      </p>
    </div>

    <div class="form-workspace-card">
      <h2>What to Expect</h2>
      <p class="description">
        How to interpret the feedback the application provides and how the interface adapts to your
        workspace.
      </p>

      <h3>Three-Tier Responsive Design</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;"
      >
        The application interface is built with a dynamic, three-tier responsive grid that
        automatically adapts to the physical width of your application window to maximize your
        productivity:
      </p>
      <ul class="guide-list" style="margin-bottom: 1.5rem;">
        <li>
          <strong>Tier 3 (Large Desktop - 1400px+):</strong> The ultimate power-user view. The interface
          expands into a massive three-column layout, displaying your Queue, Configuration panel, and
          Real-time Output Log side-by-side simultaneously.
        </li>
        <li>
          <strong>Tier 2 (Medium Display - 800px to 1399px):</strong> The balanced view. The interface
          collapses into a split two-column layout. The left column neatly stacks your Queue and Configuration
          panels, while the right column remains dedicated to monitoring the Output Log.
        </li>
        <li>
          <strong>Tier 1 (Small Window / Mobile - under 800px):</strong> The focused view. Everything
          stacks into a single, scrollable vertical column to prioritize the element you are actively
          interacting with without feeling cramped.
        </li>
      </ul>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem; padding-left: 0.5rem; border-left: 3px solid var(--accent-color);"
      >
        <strong>Persistent Layout Memory:</strong> You don't need to resize the application every time
        you launch it. The application automatically tracks your exact window dimensions, coordinates,
        and maximized state. Whenever you exit, this data is seamlessly saved, ensuring the window snaps
        perfectly back to the exact layout tier and location you left it in on your next launch.
      </p>

      <h3>Live Processing Metrics</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.5rem;"
      >
        During a batch run, the global metrics panel tracks your overall progress. It displays the
        active files being processed, the number of files completed, and explicitly shows the <strong
          >total size</strong
        >
        directly under the <strong>total scanned</strong> files count. Once the batch finishes, the
        final <strong>storage delta</strong> is presented with dynamic <strong>color-coding</strong> (e.g.,
        green for space saved, red for space lost) so you can instantly evaluate your storage efficiency
        at a glance.
      </p>

      <h3>Clean Real-Time Pipeline Output</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1rem;"
      >
        Instead of throwing an unreadable wall of raw technical text at you, the terminal cleanly
        parses the real-time processing data behind the scenes. You will see clear, concise status
        updates for each file, including its exact progress percentage, speed, and any relevant
        warnings. It also tracks the <strong>total size</strong> processed directly in the log. At
        the end of a run, the final summary metrics are printed on <strong>separate lines</strong>
        for much easier reading and review. To help you navigate large batches, use the
        <strong>Scroll to Top</strong>
        and <strong>Scroll to Bottom</strong> buttons located inside the log panel to quickly jump through
        the terminal history.
      </p>
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
        <li>
          <span
            class="log-info"
            style="color: var(--accent-color); font-weight: 600; display: block; margin-bottom: 0.25rem;"
            >🛡️ [SYSTEM GUARD]:</span
          >
          These entries appear when the application detects system resource congestion (high CPU/low Memory).
          It will log when it pauses the pipeline to protect your OS, and when it successfully resumes
          operations.
        </li>
      </ul>

      <h3 style="margin-top: 1.5rem;">Graceful Application Exit</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        You can safely close the application at any time, even right in the middle of processing a
        large batch of files. When you click the 'X' to close the window, the application intercepts
        the request and runs a clean-up routine behind the scenes. It safely terminates any running
        FFmpeg and MKVmerge processes, preventing orphan background processes from consuming your
        CPU or memory after the application exits.
      </p>

      <h3 style="margin-top: 1.5rem;">System Notifications</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        By default, the application will show a desktop system notification when your processing
        queue finishes. You can opt out of these by disabling the <span class="highlight"
          >"System Notifications"</span
        >
        toggle in the <a href="/settings" class="guide-link">Settings (⚙️)</a> page.
      </p>

      <h3 style="margin-top: 1.5rem;">Accessing Processed Files</h3>
      <p
        style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.75rem;"
      >
        Once a batch finishes, you can quickly jump to your newly created files without having to
        manually hunt through your file system:
      </p>
      <ol class="guide-list" style="list-style-type: decimal; padding-left: 2rem;">
        <li>
          Locate the completed directory in your <strong>Target Processing Queue</strong> (it will have
          a green success state).
        </li>
        <li>
          Click the <strong>Open Folder</strong> icon located on the far right side of that queue item.
        </li>
        <li>
          Your operating system's native file explorer will instantly open the correct output
          directory (even if the files were generated inside nested subfolders).
        </li>
      </ol>

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

    <div class="form-workspace-card">
      <h2>Troubleshooting</h2>
      <p class="description">Common questions and solutions when operating the application.</p>

      <h3 style="margin-top: 1rem;">High Memory Usage During Development (IDE)</h3>
      <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
        If you are a developer compiling and running the application in a local development
        environment alongside an IDE (such as VS Code or Antigravity), you might notice massive RAM
        consumption during processing batches.
        <strong>This is not a memory leak in the desktop application itself.</strong>
        The memory spike is caused by the IDE's background language servers actively analyzing the rapid
        source tree changes (such as the target directories generating output files) and intercepting
        the massive real-time terminal output stream. When the application is compiled and run natively
        as a standalone production binary, these memory spikes do not occur.
      </p>
    </div>
  </div>
</main>

<style lang="scss">
  /* Guide uses the global .app-container shell from app.scss.
     Override: single-column layout only. */
  .app-container {
    max-width: none;
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
    gap: 1rem;
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
    flex: none;

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
  .log-legend li:nth-child(4) {
    border-left-color: var(--accent-color);
  }
</style>
