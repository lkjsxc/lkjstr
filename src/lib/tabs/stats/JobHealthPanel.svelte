<script lang="ts">
  import type { JobHealthSummary } from '$lib/jobs/job-health';

  type Props = {
    jobHealth: JobHealthSummary | null;
  };

  let props: Props = $props();

  function formatAge(ms?: number): string {
    if (ms === undefined) return 'none';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return `${Math.max(0, Math.floor(ms / 1000))}s`;
    return `${minutes}m`;
  }

  function formatTime(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toLocaleString() : 'never';
  }
</script>

{#if props.jobHealth}
  <h3>Jobs</h3>
  <div class="stats-cards">
    <article>
      <strong>{props.jobHealth.total}</strong><span>stored jobs</span>
    </article>
    <article>
      <strong>{props.jobHealth.statusCounts.queued}</strong><span>queued</span>
    </article>
    <article>
      <strong>{props.jobHealth.statusCounts.running}</strong><span>running</span
      >
    </article>
    <article>
      <strong>{formatAge(props.jobHealth.oldestQueuedAgeMs)}</strong>
      <span>oldest queued</span>
    </article>
  </div>
  <p>
    latest failure {props.jobHealth.latestFailure?.error ?? 'none'} · stale startup
    {formatTime(props.jobHealth.latestStaleStartupMark?.staleStartedAt)}
  </p>
{/if}
