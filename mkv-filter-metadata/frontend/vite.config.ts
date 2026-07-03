/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const host = process.env.TAURI_DEV_HOST;

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

const commitHash: string = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (e) {
    console.warn('Failed to get commit hash', e);
    return 'unknown';
  }
})();

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [sveltekit()],

  resolve: {
    conditions: process.env.VITEST ? ['browser'] : undefined
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest-setup.js'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 98,
        functions: 100,
        branches: 84,
        statements: 97
      }
    }
  },

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __TAURI_VERSION__: JSON.stringify(
      pkg.dependencies['@tauri-apps/api']?.replace(/[\^~]/g, '') || 'unknown'
    ),
    __SVELTE_VERSION__: JSON.stringify(
      pkg.devDependencies['svelte']?.replace(/[\^~]/g, '') || 'unknown'
    ),
    __NODE_VERSION__: JSON.stringify(process.version)
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  esbuild: {
    drop:
      process.env.NODE_ENV === 'production'
        ? (['console', 'debugger'] as ('console' | 'debugger')[])
        : []
  },
  build: {
    target: 'es2022'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022'
    }
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  },
  envPrefix: ['VITE_', 'TAURI_']
}));
