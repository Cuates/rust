import { defineConfig, createLogger } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

const host = process.env.TAURI_DEV_HOST;

const customLogger = createLogger();
const originalError = customLogger.error;
/**
 * @param {string} msg
 * @param {import('vite').LogOptions} options
 */
customLogger.error = (msg, options) => {
  if (msg.includes('The following Vite config options will be overridden by SvelteKit')) {
    return;
  }
  originalError(msg, options);
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  customLogger,
  plugins: [sveltekit()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
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
