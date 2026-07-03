<script lang="ts">
  import { initConfigWatcher } from '$lib/stores/config.svelte';
  import { initShortcutWatcher } from '$lib/stores/shortcuts.svelte';

  let { children } = $props();

  initConfigWatcher();
  initShortcutWatcher();
</script>

<div data-testid="test-wrapper">
  Wrapper
  {#if children}
    {@render children()}
  {/if}
</div>
