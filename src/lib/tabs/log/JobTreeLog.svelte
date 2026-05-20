<script lang="ts">
  import type { JobRecord } from '$lib/events/types';
  import { sharedJobManager } from '$lib/jobs/job-manager';

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
</script>

{#if roots.length > 0}
  <section class="job-tree-log" aria-label="Job tree">
    <h3>Jobs</h3>
    {#each roots as root (root.id)}
      <details open>
        <summary>{label(root)} · {root.status}</summary>
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
            </li>
          {/each}
        </ul>
      </details>
    {/each}
  </section>
{/if}
