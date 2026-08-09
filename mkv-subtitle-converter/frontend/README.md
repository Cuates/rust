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

Communication with the system layer uses asynchronous multi-channel IPC frameworks. All IPC payload types are **auto-generated** from Rust structs via `specta` + `specta-zod` and written to `src/lib/types/ipc.ts`. Do not edit `ipc.ts` manually — run `pnpm run generate:types` to regenerate it.

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';
import type { IpcPayloadData } from '$lib/types/ipc';

const progressChannel = new Channel<IpcPayloadData>();

progressChannel.onmessage = (message) => {
  switch (message.type) {
    case 'fileProcessed':
      console.log(`Processed: ${message.payload.fileCompleted}`);
      break;
    case 'cancelled':
      console.log('Processing cancelled.');
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

## Dead-Code Analysis

This project uses `knip` for static dead-code detection. To run it:

```bash
pnpm run check:deadcode
```

Configuration is in `frontend/knip.json`. Auto-generated files (like `src/lib/types/ipc.ts`) are excluded from analysis via the `ignore` list.

## Testing

Frontend tests use **Vitest** with **@testing-library/svelte** in a `jsdom` environment. All tests live alongside their components (e.g., `Component.test.ts` next to `Component.svelte`).

### Scripts

| Command                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| `pnpm -F frontend test:unit` | Run all unit tests once (with `svelte-kit sync` prefix for CI). |
| `pnpm -F frontend coverage`  | Run tests with V8 coverage report generation.                   |

### Coverage Thresholds

Enforced in `vite.config.ts`:

| Metric     | Threshold | Notes                                                                   |
| ---------- | --------- | ----------------------------------------------------------------------- |
| Statements | 90%       |                                                                         |
| Functions  | 90%       |                                                                         |
| Lines      | 90%       |                                                                         |
| Branches   | 70%       | Intentionally lower — Svelte 5 Rune compilation artifacts inflate count |

### Mocking Tauri in Tests

Tauri's `invoke`, `Channel`, `listen`, and plugin APIs must be mocked in `vi.mock()` blocks. Use `Channel<IpcPayloadData>` from `@tauri-apps/api/core` for strongly-typed channel mocks — never use `any`.

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';
import type { IpcPayloadData } from '$lib/types/ipc';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: class MockChannel<T> {
    onmessage: ((message: T) => void) | undefined;
  }
}));
```
