import { V as escape_html, G as attr, J as attr_class, Q as ensure_array_like, K as attr_style, a8 as stringify } from "../../chunks/renderer.js";
import "@tauri-apps/api/core";
import "@tauri-apps/plugin-dialog";
import "@tauri-apps/api/event";
import "@tauri-apps/api/window";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let config = {
      input_directories: [],
      file_extensions: "mkv, mp4, mov, avi, ogm, wmv",
      subtitle_tracks: "ang, eng, enm, zxx, und",
      output_extension: ".mkv",
      conversion_mode: "remux",
      video_codec: "libx265",
      preset: "faster",
      crf: "18"
    };
    let consoleLogs = [];
    let processingActive = false;
    let isDragging = false;
    let directoryStatuses = {};
    let directoryErrors = {};
    let pointerDraggingIndex = null;
    let pointerStartY = 0;
    let pointerCurrentY = 0;
    function getLogClass(line) {
      const lower = line.toLowerCase();
      if (lower.includes("[error]") || line.includes("❌") || lower.startsWith("error")) return "log-error";
      if (line.includes("⚠️")) return "log-warning";
      if (line.includes("✅") || lower.includes("success")) return "log-success";
      if (lower.includes("[info]")) return "log-info";
      return "";
    }
    let copiedStatus = false;
    let savedStatus = false;
    $$renderer2.push(`<main class="app-container svelte-1uha8ag"><header class="navbar-layer svelte-1uha8ag"><h1 class="svelte-1uha8ag">MKV Filter Metadata</h1> <button class="theme-toggle-icon-btn svelte-1uha8ag" aria-label="Toggle color display theme">`);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`☀️`);
    }
    $$renderer2.push(`<!--]--></button></header> <div class="form-workspace-card svelte-1uha8ag"><div class="row svelte-1uha8ag"><div class="queue-header svelte-1uha8ag"><label for="queue-box" class="svelte-1uha8ag">Target Processing Queue (${escape_html(config.input_directories.length)})</label> <div style="display: flex; gap: 0.5rem; align-items: center;" class="svelte-1uha8ag">`);
    if (config.input_directories.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<button class="clear-queue-btn svelte-1uha8ag"${attr("disabled", processingActive, true)} title="Clear entire queue" aria-label="Clear entire processing queue"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><polyline points="3 6 5 6 21 6" class="svelte-1uha8ag"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" class="svelte-1uha8ag"></path><line x1="10" y1="11" x2="10" y2="17" class="svelte-1uha8ag"></line><line x1="14" y1="11" x2="14" y2="17" class="svelte-1uha8ag"></line></svg></button>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="add-folder-btn svelte-1uha8ag"${attr("disabled", processingActive, true)}>+ Add Folder to Queue</button></div></div> <div id="queue-box"${attr_class("queue-container svelte-1uha8ag", void 0, { "dragging": isDragging })} role="button" tabindex="0">`);
    if (config.input_directories.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="empty-queue-msg svelte-1uha8ag">Drag &amp; drop video folders here or click Add Folder...</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<!--[-->`);
      const each_array = ensure_array_like(config.input_directories);
      for (let i = 0, $$length = each_array.length; i < $$length; i++) {
        let dir = each_array[i];
        $$renderer2.push(`<div${attr_class("queue-item svelte-1uha8ag", void 0, {
          "dragging-item": pointerDraggingIndex === i,
          "status-processing": directoryStatuses[dir] === "processing",
          "status-done": directoryStatuses[dir] === "done" && !directoryErrors[dir],
          "status-warning": directoryStatuses[dir] === "done" && directoryErrors[dir]
        })}${attr_style(pointerDraggingIndex === i ? `transform: translateY(${i === config.input_directories.length - 1 && pointerCurrentY - pointerStartY > 0 ? Math.min(pointerCurrentY - pointerStartY, 20) : pointerCurrentY - pointerStartY}px); z-index: 10; position: relative;` : "")} role="listitem"><div class="queue-path-wrapper svelte-1uha8ag">`);
        if (directoryStatuses[dir] === "processing") {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="status-indicator processing svelte-1uha8ag" title="Processing..."><svg class="spinner svelte-1uha8ag" viewBox="0 0 50 50"><circle class="path svelte-1uha8ag" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle></svg></div>`);
        } else if (directoryStatuses[dir] === "done") {
          $$renderer2.push("<!--[1-->");
          if (directoryErrors[dir]) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<div class="status-indicator warning svelte-1uha8ag" title="Finished with warnings or errors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" class="svelte-1uha8ag"></path><line x1="12" y1="9" x2="12" y2="13" class="svelte-1uha8ag"></line><line x1="12" y1="17" x2="12.01" y2="17" class="svelte-1uha8ag"></line></svg></div>`);
          } else {
            $$renderer2.push("<!--[-1-->");
            $$renderer2.push(`<div class="status-indicator done svelte-1uha8ag" title="Finished successfully"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><polyline points="20 6 9 17 4 12" class="svelte-1uha8ag"></polyline></svg></div>`);
          }
          $$renderer2.push(`<!--]-->`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <span class="queue-path svelte-1uha8ag"${attr("title", dir)}>${escape_html(dir)}</span></div> <div class="queue-actions svelte-1uha8ag" style="display: flex; align-items: center; gap: 0.25rem;">`);
        {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> <button class="remove-btn svelte-1uha8ag"${attr("disabled", processingActive, true)} aria-label="Remove item from path processing queue"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><line x1="18" y1="6" x2="6" y2="18" class="svelte-1uha8ag"></line><line x1="6" y1="6" x2="18" y2="18" class="svelte-1uha8ag"></line></svg></button></div></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="grid-layout-2 svelte-1uha8ag"><div class="row svelte-1uha8ag"><label for="conv-mode" class="svelte-1uha8ag">Conversion Mode</label> `);
    $$renderer2.select(
      {
        id: "conv-mode",
        value: config.conversion_mode,
        disabled: processingActive,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option(
          { value: "remux", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`Remux (Stream Copy)`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "reencode", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`Reencode Processing`);
          },
          "svelte-1uha8ag"
        );
      },
      "svelte-1uha8ag"
    );
    $$renderer2.push(`</div> <div class="row svelte-1uha8ag"><label for="out-ext" class="svelte-1uha8ag">Output Extension</label> <input id="out-ext"${attr("value", config.output_extension)} placeholder=".mkv" autocomplete="off"${attr("disabled", processingActive, true)} class="svelte-1uha8ag"/></div></div> <div class="grid-layout-2 svelte-1uha8ag"><div class="row svelte-1uha8ag"><label for="exts" class="svelte-1uha8ag">File Extensions Filter</label> <input id="exts"${attr("value", config.file_extensions)} placeholder="mkv, mp4, mov, avi, ogm, wmv" autocomplete="off"${attr("disabled", processingActive, true)} class="svelte-1uha8ag"/></div> <div class="row svelte-1uha8ag"><label for="subs" class="svelte-1uha8ag">Subtitle Tracks to Keep</label> <input id="subs"${attr("value", config.subtitle_tracks)} placeholder="ang, eng, enm, zxx, und" autocomplete="off"${attr("disabled", processingActive, true)} class="svelte-1uha8ag"/></div></div> <div${attr_class("advanced-wrapper svelte-1uha8ag", void 0, { "expanded": config.conversion_mode === "reencode" })}><div class="reencode-advanced-panel svelte-1uha8ag"><div class="grid-layout-3 svelte-1uha8ag"><div class="row svelte-1uha8ag"><label for="v-codec" class="svelte-1uha8ag">Video Encoder</label> `);
    $$renderer2.select(
      {
        id: "v-codec",
        value: config.video_codec,
        disabled: processingActive,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option(
          { value: "libx265", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`libx265 (CPU)`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "libx264", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`libx264 (CPU)`);
          },
          "svelte-1uha8ag"
        );
        {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-1uha8ag"
    );
    $$renderer2.push(`</div> <div class="row svelte-1uha8ag"><label for="preset-val" class="svelte-1uha8ag">Encoder Preset</label> `);
    $$renderer2.select(
      {
        id: "preset-val",
        value: config.preset,
        disabled: processingActive,
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option(
          { value: "ultrafast", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`ultrafast`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "superfast", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`superfast`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "veryfast", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`veryfast`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "faster", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`faster`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "fast", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`fast`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "medium", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`medium`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "slow", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`slow`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "slower", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`slower`);
          },
          "svelte-1uha8ag"
        );
        $$renderer3.option(
          { value: "veryslow", class: "" },
          ($$renderer4) => {
            $$renderer4.push(`veryslow`);
          },
          "svelte-1uha8ag"
        );
      },
      "svelte-1uha8ag"
    );
    $$renderer2.push(`</div> <div class="row svelte-1uha8ag"><label for="crf-val" class="svelte-1uha8ag">CRF (0-51)</label> <input id="crf-val" type="number"${attr("value", parseInt(config.crf))} min="0" max="51" autocomplete="off"${attr("disabled", processingActive, true)} class="svelte-1uha8ag"/></div></div></div></div> <div class="action-row svelte-1uha8ag">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button class="action-trigger-btn svelte-1uha8ag"${attr("disabled", config.input_directories.length === 0, true)}>${escape_html("Start Processing")}</button></div></div> <div class="output-workspace-area svelte-1uha8ag">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="terminal-container svelte-1uha8ag"><div class="terminal-header-row svelte-1uha8ag"><h3 class="svelte-1uha8ag">Real-time Output Pipeline Log</h3> `);
    if (consoleLogs.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="terminal-actions svelte-1uha8ag"><button${attr_class("copy-logs-btn svelte-1uha8ag", void 0, { "copied": savedStatus })} aria-label="Save logs"${attr("data-tooltip", "Save logs")}>`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" class="svelte-1uha8ag"></path><polyline points="17 21 17 13 7 13 7 21" class="svelte-1uha8ag"></polyline><polyline points="7 3 7 8 15 8" class="svelte-1uha8ag"></polyline></svg>`);
      }
      $$renderer2.push(`<!--]--></button> <button${attr_class("copy-logs-btn svelte-1uha8ag", void 0, { "copied": copiedStatus })} aria-label="Copy logs"${attr("data-tooltip", "Copy logs")}>`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svelte-1uha8ag"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" class="svelte-1uha8ag"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" class="svelte-1uha8ag"></path></svg>`);
      }
      $$renderer2.push(`<!--]--></button></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div id="terminal-shell" class="terminal-shell svelte-1uha8ag">`);
    const each_array_1 = ensure_array_like(consoleLogs);
    if (each_array_1.length !== 0) {
      $$renderer2.push("<!--[-->");
      for (let i = 0, $$length = each_array_1.length; i < $$length; i++) {
        let log = each_array_1[i];
        $$renderer2.push(`<div${attr_class(`log-line ${stringify(getLogClass(log))}`, "svelte-1uha8ag")}>${escape_html(log)}</div>`);
      }
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="empty-log-msg svelte-1uha8ag">Logs will appear here once processing begins...</div>`);
    }
    $$renderer2.push(`<!--]--></div></div></div></main>`);
  });
}
export {
  _page as default
};
