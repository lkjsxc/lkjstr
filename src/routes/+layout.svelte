<script lang="ts">
  import { onMount } from 'svelte';
  import { startGlobalLogCapture } from '$lib/log/app-log';
  import '../styles/tokens.css';
  import '../styles/theme.css';
  import '../styles/app.css';
  import '../styles/workspace-tabs.css';
  import '../styles/workspace-menu.css';
  import '../styles/timeline.css';
  import '../styles/tables.css';

  let { children } = $props();

  onMount(startGlobalLogCapture);
</script>

{@render children()}
