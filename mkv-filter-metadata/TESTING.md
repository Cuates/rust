# Testing Strategy: MKV Filter Metadata

This application uses a hybrid testing strategy to ensure 100% logic safety while maintaining a fast, reliable CI/CD pipeline.

## 1. Unit Testing (Vitest & Cargo Test)

Unit testing covers all mathematical logic, state updates, component lifecycles, and Rust API handlers in isolation.

**Command:** 
```bash
npm run test:coverage
# or
pnpm run test:coverage
```

**Where to Run:** 
- **GitHub Actions (CI/CD):** Yes! This is the core validation check for the automated pipeline.
- **Locally:** Yes!

**Why it works in CI:**
Unit tests run entirely in memory using a virtual headless environment (JSDOM for Svelte, standard test harness for Rust). They execute in seconds, do not require an active display monitor, and are immune to `WebView2` hanging issues. Our `vite.config.ts` enforces ~90%+ coverage mathematically.

