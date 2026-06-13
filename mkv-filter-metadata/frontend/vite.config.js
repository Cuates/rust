import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const host = process.env.TAURI_DEV_HOST;

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {
  console.warn('Failed to get commit hash', e);
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit()],

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
