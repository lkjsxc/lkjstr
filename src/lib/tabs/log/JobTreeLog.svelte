<script lang="ts">
  import type { JobRecord } from '$lib/events/types';
  import { sharedJobManager } from '$lib/jobs/job-manager';
  import { terminalJobStatus } from '$lib/jobs/job-record';

  let jobs = $state<readonly JobRecord[]>([]);

  $effect(() => sharedJobManager.subscribe((next) => (jobs = next)));

  let roots = $derived(
    jobs
      .filter((job) => job.rootId === job.id)
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );

  function label(job: JobRecord): string {
    return job.label ?? job.kind;
  }

  function tree(root: JobRecord): JobRecord[] {
    return jobs
      .filter((job) => job.rootId === root.id)
      .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')));
  }

  function formatTimestamp(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toLocaleString() : '';
  }

  function metadata(job: JobRecord): string {
    return [
      job.cancelRequestedAt
        ? `cancel ${formatTimestamp(job.cancelRequestedAt)}`
        : '',
      job.canceledBy ? `by ${job.canceledBy}` : '',
      job.completedAt ? `done ${formatTimestamp(job.completedAt)}` : '',
      job.staleStartedAt ? `stale ${formatTimestamp(job.staleStartedAt)}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function cancel(root: JobRecord, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    void sharedJobManager.cancelTree(root.id);
  }
</script>

{#if roots.length > 0}
  <section class="job-tree-log" aria-label="Job tree">
    <h3>Jobs</h3>
    {#each roots as root (root.id)}
      <details open>
        <summary>
          <span>{label(root)} · {root.status}</span>
          {#if !terminalJobStatus(root.status)}
            <button type="button" onclick={(event) => cancel(root, event)}>
              Cancel
            </button>
          {/if}
        </summary>
        <ul>
          {#each tree(root) as job (job.id)}
            <li style={`--job-depth: ${Math.max(0, job.path.length - 1)}`}>
              <span>{label(job)} · {job.status}</span>
              {#if job.progress}
                <small>
                  {job.progress.current}{job.progress.total
                    ? `/${job.progress.total}`
                    : ''}
                </small>
              {/if}
              {#if job.error}<small>{job.error}</small>{/if}
              {#if metadata(job)}<small>{metadata(job)}</small>{/if}
            </li>
          {/each}
        </ul>
      </details>
    {/each}
  </section>
{/if}
