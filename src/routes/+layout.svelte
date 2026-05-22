<script lang="ts">
  import { onMount } from 'svelte';
  import { startGlobalLogCapture } from '$lib/log/app-log';
  import '../styles/tokens.css';
  import '../styles/theme.css';
  import '../styles/app.css';
  import '../styles/workspace-tabs.css';
  import '../styles/workspace-menu.css';
  import '../styles/timeline.css';
  import '../styles/notifications.css';
  import '../styles/content-warning.css';
  import '../styles/mentions.css';
  import '../styles/reactions.css';
  import '../styles/event-actions.css';
  import '../styles/identity.css';
  import '../styles/tables.css';
  import '../styles/stats.css';
  import '../styles/tweet.css';

  let { children } = $props();

  onMount(startGlobalLogCapture);
</script>

{@render children()}
