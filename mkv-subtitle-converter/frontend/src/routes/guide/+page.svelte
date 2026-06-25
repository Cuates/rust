<script lang="ts">
  // No active state logic needed since this is purely a static guide page
</script>

<svelte:head>
  <title>Guide - MKV Subtitle Converter</title>
</svelte:head>

<main class="page">
  <div class="header">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/" class="back-link">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Back to Home
    </a>
    <h1>How To Use</h1>
  </div>

  <div class="scrollable-content">
    <section class="guide-section">
      <h2>Getting Started</h2>
      <p class="description">
        Learn how to easily add directories and configure your processing queue.
      </p>
      <ul class="guide-list">
        <li>
          <strong>Adding Directories:</strong> You can add directories to the processing queue by
          clicking the <span class="highlight">"+ Add Folder"</span> button on the main dashboard, or
          by simply dragging and dropping a folder from your operating system directly onto the application
          window.
        </li>
        <li>
          <strong>Managing the Queue:</strong> You can remove individual directories from the queue
          by clicking the <span class="highlight">Trash</span> icon next to them. Or, you can clear
          the entire queue at once by clicking the
          <span class="highlight">Trash (Clear All)</span> icon at the top of the queue list.
          Additionally, you can re-order folders to prioritize which gets processed first. Either
          drag and drop folders directly within the list using your mouse, or select a folder and
          use the
          <span class="highlight">Alt + ArrowUp</span> /
          <span class="highlight">Alt + ArrowDown</span>
          keyboard shortcuts for precise reordering. These shortcuts can be customized to your liking
          in the
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href="/settings" class="guide-link">Settings (⚙️)</a> page.
        </li>
        <li>
          <strong>Folder Insights & Reports:</strong> As a folder processes, its badge displays a
          live
          <span class="highlight">[ M / N files ]</span> progress sub-count. Once processing
          finishes or encounters an error, a
          <span class="highlight">"View Report"</span>
          button appears. Clicking it expands a fully accessible modal dialog detailing exactly which
          files succeeded (including metadata like <strong>language</strong>,
          <strong>codec</strong>, and
          <strong>track name</strong>) and which failed. You can use your keyboard to navigate the
          report or press
          <span class="highlight">Esc</span> to quickly close it and safely return focus to the
          queue.
          <br /><br />
          <em
            >Note: If you manually delete or corrupt the underlying report files, the app will
            gracefully handle it and notify you that the data is no longer available.</em
          >
        </li>
        <li>
          <strong>Smart Skips & Retries:</strong> The application uses an internal history cache to
          remember which files were successfully converted. Clicking
          <span class="highlight">"Start Conversion"</span>
          will automatically skip files that have already been processed in the past, and immediately
          retry any new or previously failed files. There is no need to manually select files to retry!
        </li>
        <li>
          <strong>Queue Persistence:</strong> By default, your queue is cleared when you close the
          application. If you'd like your queue to persist across reboots, you can enable the
          <span class="highlight">"Remember queue"</span>
          option located in the
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href="/settings" class="guide-link">Settings (⚙️)</a> page.
        </li>
        <li>
          <strong>Appearance / Theme:</strong> You can choose between System, Light, and Dark themes
          by navigating to the
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href="/settings" class="guide-link">Settings (⚙️)</a> page and selecting your preferred mode
          under the Appearance section. The app will instantly apply and remember your choice.
        </li>
      </ul>
    </section>

    <section class="guide-section">
      <h2>The Extraction Process</h2>
      <p class="description">
        Understand how the application processes your MKV files and extracts subtitles.
      </p>
      <div class="mode-card">
        <h3>MKV to ASS Conversion</h3>
        <p class="text-sm">
          This application scans your directories for MKV video files, probes them for embedded
          subtitle tracks, and attempts to extract the SRT subtitle track(s). It then converts the
          extracted track to the Advanced SubStation Alpha (<code>.ass</code>) format using FFmpeg.
          The new subtitle file is saved in the same directory alongside the original video file.
        </p>
      </div>
      <div class="mode-card">
        <h3>Parallel Processing</h3>
        <p class="text-sm">
          You can control how many files are processed simultaneously by adjusting the <span
            class="highlight">"Parallel File Processing"</span
          >
          slider in the <!-- eslint-disable-next-line svelte/no-navigation-without-resolve --><a
            href="/settings"
            class="guide-link">Settings</a
          > page. Increasing this value will utilize more of your computer's CPU and disk I/O to speed
          up bulk conversions. The application dynamically processes files across the entire queue based
          on this concurrency limit.
        </p>
      </div>
    </section>

    <section class="guide-section">
      <h2>What to Expect</h2>
      <p class="description">
        How to interpret the feedback the application provides during processing.
      </p>

      <h3>Terminal Output Logs</h3>
      <ul class="guide-list log-legend">
        <li>
          <span class="log-success">🟢 Success:</span> Indicates a subtitle track was successfully found,
          extracted, and converted to an ASS file. You'll see the global metrics panel automatically update.
        </li>
        <li>
          <span class="log-warning">🟡 Skipped/Warning:</span> Indicates a file was skipped. This typically
          happens if no valid subtitle tracks were found inside the MKV, or if the file has already been
          successfully processed in the past.
        </li>
        <li>
          <span class="log-error">🔴 Error:</span> Indicates a critical failure processing a specific
          file. This can be caused by file corruption, missing read/write permissions, or FFmpeg conversion
          errors. The application will log the error and seamlessly continue processing the rest of the
          queue.
        </li>
        <li style="margin-top: 8px;">
          <strong>Saving Logs:</strong> You can click the <span class="highlight">Save Log</span> button
          in the terminal panel at any time. The app intelligently combines your entire session history,
          even across background log rotations, ensuring you always get a complete record.
        </li>
      </ul>

      <h3 class="mt-4">Clear Processing History</h3>
      <p class="text-sm">
        The application keeps track of which files have already been successfully processed to
        prevent redundant work. If you need to re-process files that were already completed in the
        past, you can click the <span class="highlight">"Clear History"</span> button in the
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href="/settings" class="guide-link">Settings</a> Data Management section. This resets the application's
        internal memory of completed files.
      </p>

      <h3 class="mt-4">Live Metrics & ETA</h3>
      <p class="text-sm">
        As your files are converting, the global metrics panel at the bottom of the screen tracks
        the exact number of files and subtitle tracks processed. You'll see a detailed breakdown of
        files that Succeeded, Failed, were Skipped, or had <span class="highlight">No Tracks</span>.
        It also displays a dynamic <strong>ETA (Estimated Time of Arrival)</strong>, actively
        calculating the remaining hours, minutes, seconds, and milliseconds until the entire queue
        finishes.
      </p>

      <h3 class="mt-4">Taskbar Progress Indicator</h3>
      <p class="text-sm">
        When the application is processing files, you can monitor the overall conversion progress
        directly from your operating system's taskbar (or dock). This allows you to easily track the
        batch process without needing to keep the application window open or maximized. Once
        processing is complete, the indicator will automatically clear.
      </p>
      <ul class="guide-list mt-2">
        <li>
          <strong>Windows:</strong> The application's taskbar icon will fill up horizontally with a green
          progress overlay (or your system's accent color).
        </li>
        <li>
          <strong>macOS:</strong> A distinct horizontal progress bar will appear along the bottom edge
          of the application icon in the Dock.
        </li>
        <li>
          <strong>Linux:</strong> On supported desktop environments (such as GNOME or Unity), a progress
          overlay will be displayed over the application's dock icon.
        </li>
      </ul>

      <h3 class="mt-4">Toast Notifications</h3>
      <p class="text-sm">
        You will occasionally see small popup notifications appear at the bottom center of the
        screen. These <strong>Toast Messages</strong> are exclusively used for global application events
        (such as confirming your settings were saved, or notifying you about clipboard copy success).
        They are distinct from the file-by-file progress logs shown in the terminal.
      </p>
    </section>
  </div>
</main>

<style lang="scss">
  .page {
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 20px 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100vh;
    overflow: hidden;
  }

  .header {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);

    h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--text-primary);
    }
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-right: 8px; /* Give room for scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) transparent;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 500;
    transition: color 0.15s;
    width: fit-content;

    svg {
      width: 16px;
      height: 16px;
    }

    &:hover {
      color: var(--accent-color);
    }
  }

  .guide-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: var(--bg-panel);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-color);

    h2 {
      margin: 0 0 4px 0;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    h3 {
      margin: 0 0 8px 0;
      font-size: 0.95rem;
      color: var(--text-primary);
    }
  }

  .description {
    margin: -10px 0 8px 0;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .text-sm {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .mt-4 {
    margin-top: 16px;
  }

  .highlight {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85em;
    color: var(--text-primary);
  }

  .guide-link {
    color: var(--accent-color);
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }

  .guide-list {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;

    li {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.5;

      strong {
        color: var(--text-primary);
      }
    }
  }

  .log-legend {
    list-style: none;
    padding-left: 0;

    li {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
  }

  .log-success {
    color: #10b981;
    font-weight: 600;
    white-space: nowrap;
  }
  .log-warning {
    color: #f59e0b;
    font-weight: 600;
    white-space: nowrap;
  }
  .log-error {
    color: #ef4444;
    font-weight: 600;
    white-space: nowrap;
  }

  .mode-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    padding: 16px;
    border-radius: 8px;
  }
</style>
