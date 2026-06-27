# Testing Guide

This project relies on robust automated testing to ensure stability across both the Rust backend and the SvelteKit frontend.

## Frontend Testing

The frontend uses [Vitest](https://vitest.dev/) for unit and component testing, combined with `@testing-library/svelte` for DOM assertions.

### Running Tests

```bash
# Run all tests in watch mode
pnpm test:unit

# Run all tests with coverage report
pnpm coverage
```

### Test Structure
- **Utility Tests**: Placed next to the file they test (e.g. `src/lib/utils/formatters.test.ts`). They test pure JS/TS functions independently of the DOM.
- **Component Tests**: Placed next to the component (e.g. `src/lib/components/MetricsPanel.test.ts`). They use Testing Library to ensure correct DOM structure, reactivity to props, and mocked user interactions.

### Mocking Tauri APIs
Tauri's native APIs (`@tauri-apps/api/core`, etc.) are not available in the Node.js test environment.
When testing components that call `invoke()`, you must mock the Tauri API in your test file:

```typescript
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({})
}));
```

## Backend Testing

The Rust backend uses standard Cargo tests. Due to the tight coupling with Tauri's AppHandle and the filesystem, much of the logic is tested via end-to-end testing, but pure functions are unit tested.

### Running Tests

```bash
# Change to backend directory
cd backend

# Run cargo tests
cargo test
```

### Writing Rust Tests
- Place `#[cfg(test)]` modules at the bottom of the file you are testing.
- For logic that touches the filesystem (e.g. checking paths, parsing SRTs), use the `tempfile` crate to generate isolated, disposable test directories.
- **Property-Based Testing**: Use the `proptest` crate to generate large permutations of inputs for functions with complex edge cases (like the SRT to ASS conversion parsing logic) to ensure no unexpected panics.
- **Tauri Command Integration**: Due to WebView2 instantiation issues in headless environments on Windows, avoid using `tauri::test::mock_builder()` or `tauri::test::create_app()` unconditionally. Instead, conditionally compile these integration tests using `#[cfg(not(target_os = "windows"))]`, and test the core backend handler functions directly for all platforms. If they perform heavy I/O, wrap them in `tokio::task::spawn_blocking`, and wrap the outer test execution in a `tokio::time::timeout` to prevent test hangs. **Note for Tauri v2**: When using `tauri::test::mock_context()`, it now requires exactly one argument implementing the `Assets` trait. Use `tauri::test::mock_context(tauri::test::noop_assets())` rather than the older four-argument signature. Additionally, be aware that `mock_builder().build()` bypasses standard Tauri lifecycles, meaning `setup()` hooks (like SQLite DB initialization) will **not** automatically execute during tests. Finally, never invoke `.blocking_lock()` on `tokio::sync::Mutex` instances inside `#[tokio::test]` functions, as this will trigger an immediate runtime panic; use `.lock().await` instead.

## Continuous Integration

- We use GitHub Actions for automated testing.
- **Intel Mac Support**: We have explicitly opted out of running CI on Intel Macs (macos-13) and will not implement a scheduled weekly job for it either. This is a pragmatic decision to avoid extreme queue times (>1 hour) on the GitHub free tier. Apple Silicon (macos-latest) provides sufficient validation for macOS CI logic.
