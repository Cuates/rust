# Frontend Layout Layer (SvelteKit, Svelte 5 & Vite)

The application front interface relies on a combination of SCSS stylesheets, static assets, and reactive **Svelte 5 Runes** (`$state`, `$derived`, `$effect`) to build a cohesive desktop UI.

## Desktop Routing Shell

Tauri requires SvelteKit to operate as a pure Single-Page Application (SPA) without a Node.js server backbone.

- **`+layout.ts`**: Explicitly disables Server-Side Rendering (SSR) and enforces static prerendering.

```typescript
export const prerender = true;
export const ssr = false;
```

## Communication Implementation Model (`+page.svelte`)

Communication with the system layer uses asynchronous multi-channel IPC frameworks.

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

interface ProgressPayload {
  event: string;
  data: any;
}

const progressChannel = new Channel<ProgressPayload>();

progressChannel.onmessage = (message) => {
  switch (message.event) {
    case 'LogMessage':
      console.log(`[Terminal Core UI Log] ${message.data}`);
      break;
  }
};

async function triggerExtractionBatch(selectedFolders: string[]) {
  try {
    await invoke('process_mkv_directory', {
      paths: selectedFolders,
      onProgress: progressChannel
    });
  } catch (error) {
    console.error(`Native runtime error reported: ${error}`);
  }
}
```
