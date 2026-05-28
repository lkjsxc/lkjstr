<script lang="ts">
  import { onMount } from 'svelte';
  import { captureStartupPromise } from '$lib/app/runtime-log';
  import { sharedJobManager } from '$lib/jobs/job-manager';
  import { startGlobalLogCapture } from '$lib/log/app-log';
  import '../styles/tokens.css';
  import '../styles/theme.css';
  import '../styles/app.css';
  import '../styles/workspace-tabs.css';
  import '../styles/workspace-pane-drop.css';
  import '../styles/workspace-resize.css';
  import '../styles/workspace-menu.css';
  import '../styles/scroll-layout.css';
  import '../styles/timeline.css';
  import '../styles/feed-scroll-restore.css';
  import '../styles/notifications.css';
  import '../styles/content-warning.css';
  import '../styles/mentions.css';
  import '../styles/reactions.css';
  import '../styles/event-actions.css';
  import '../styles/identity.css';
  import '../styles/tables.css';
  import '../styles/welcome.css';
  import '../styles/stats.css';
  import '../styles/tweet.css';

  let { children } = $props();

  onMount(() => {
    const stopLogCapture = startGlobalLogCapture();
    captureStartupPromise(
      sharedJobManager
        .load()
        .then(() => sharedJobManager.markStaleStartupJobs()),
      { code: 'job-manager-startup-failed', surface: 'layout', kind: 'jobs' },
    );
    return stopLogCapture;
  });
</script>

{@render children()}
