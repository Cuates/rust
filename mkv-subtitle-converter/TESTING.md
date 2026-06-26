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
- **Tauri Command Integration**: Due to WebView2 instantiation issues in headless environments on Windows, avoid using `tauri::test::mock_builder()`. Instead, test the core backend handler functions directly. If they perform heavy I/O, wrap them in `tokio::task::spawn_blocking`, and wrap the outer test execution in a `tokio::time::timeout` to prevent test hangs.
