<script lang="ts">
  import { initConfigWatcher } from '$lib/stores/config.svelte';
  import { initShortcutWatcher } from '$lib/stores/shortcuts.svelte';

  initConfigWatcher();
  initShortcutWatcher();
</script>

<div data-testid="test-wrapper">Wrapper</div>
