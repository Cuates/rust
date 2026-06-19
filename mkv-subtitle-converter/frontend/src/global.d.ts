declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

declare const __APP_VERSION__: string;
declare const __COMMIT_HASH__: string;
declare const __BUILD_DATE__: string;
declare const __TAURI_VERSION__: string;
declare const __SVELTE_VERSION__: string;
declare const __NODE_VERSION__: string;
