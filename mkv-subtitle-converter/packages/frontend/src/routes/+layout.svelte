<script lang="ts">
  import '../styles/app.scss';
  import { onMount } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  // SvelteKit automatically passes downstream page data/nodes via the children snippet in Svelte 5
  let { children } = $props();
  let currentTheme = $state('dark');

  async function syncNativeTitleBar(theme: string) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setTheme(theme === 'dark' ? 'dark' : 'light');
    } catch (error) {
      // Gracefully catch if executed inside a standard browser environment during previewing
      console.error('Failed to sync native platform titlebar adjustments:', error);
    }
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    syncNativeTitleBar(currentTheme);
  }

  onMount(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    syncNativeTitleBar(currentTheme);
  });
</script>

<div class="container">
  <div class="theme-toggle-wrapper" data-tooltip={currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>
    <button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle application theme">
      {currentTheme === 'light' ? '🌙' : '☀️'}
    </button>
  </div>

  {#if children}
    {@render children()}
  {/if}
</div>