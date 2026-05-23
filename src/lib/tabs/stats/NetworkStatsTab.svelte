<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { cacheStatus, type CacheMetadata } from '$lib/cache/cache-status';
  import {
    listRelayDiagnosticSummaries,
    type RelayDiagnosticSummary,
  } from '$lib/relays/relay-diagnostic-summary';
  import {
    loadJobHealthSummary,
    type JobHealthSummary,
  } from '$lib/jobs/job-health';
  import { currentRelaySnapshots } from '$lib/relays/session-snapshots';
  import type { RelaySessionStats, RelaySnapshot } from '$lib/relays/types';

  let snapshots = $state<RelaySnapshot[]>([]);
  let summaries = $state<RelayDiagnosticSummary[]>([]);
  let jobHealth = $state<JobHealthSummary | null>(null);
  let cache = $state<CacheMetadata | null>(null);
  let autoRefresh = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let totals = $derived(totalStats(snapshots));

  onMount(() => void refresh());
  onDestroy(() => stopAutoRefresh());

  async function refresh(): Promise<void> {
    snapshots = currentRelaySnapshots();
    summaries = await listRelayDiagnosticSummaries();
    jobHealth = await loadJobHealthSummary();
    cache = await cacheStatus();
  }

  function toggleAuto(): void {
    stopAutoRefresh();
    if (autoRefresh) timer = setInterval(() => void refresh(), 2000);
  }

  function stopAutoRefresh(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = undefined;
  }

  function totalStats(items: readonly RelaySnapshot[]) {
    return items.reduce(
      (sum, item) => ({
        relays: sum.relays + 1,
        open: sum.open + (item.state === 'open' ? 1 : 0),
        events: sum.events + stats(item).eventCount,
        bytes: sum.bytes + stats(item).receivedBytes + stats(item).sentBytes,
        ok: sum.ok + stats(item).okAcceptedCount,
        rejected: sum.rejected + stats(item).okRejectedCount,
        subs: sum.subs + stats(item).activeSubscriptionIds.length,
      }),
      { relays: 0, open: 0, events: 0, bytes: 0, ok: 0, rejected: 0, subs: 0 },
    );
  }

  function stats(snapshot: RelaySnapshot): RelaySessionStats {
    return (
      snapshot.stats ?? {
        receivedBytes: 0,
        sentBytes: 0,
        eventCount: 0,
        eoseCount: 0,
        noticeCount: 0,
        authCount: 0,
        closedCount: 0,
        okAcceptedCount: 0,
        okRejectedCount: 0,
        parseErrorCount: 0,
        activeSubscriptionIds: [],
      }
    );
  }

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

<section class="data-tab stats-tab" aria-label="Stats">
  <header class="settings-header">
    <div class="settings-actions">
      <button type="button" onclick={() => void refresh()}>Refresh</button>
      <label class="stats-auto">
        <input
          type="checkbox"
          bind:checked={autoRefresh}
          onchange={toggleAuto}
        />
        <span>Auto refresh every 2s</span>
      </label>
    </div>
  </header>
  <div class="stats-cards">
    <article><strong>{totals.relays}</strong><span>relays</span></article>
    <article><strong>{totals.open}</strong><span>open</span></article>
    <article><strong>{totals.subs}</strong><span>subscriptions</span></article>
    <article><strong>{totals.events}</strong><span>events</span></article>
    <article><strong>{totals.ok}</strong><span>OK accepted</span></article>
    <article>
      <strong>{totals.rejected}</strong><span>OK rejected</span>
    </article>
  </div>
  <table class="stats-table">
    <thead>
      <tr
        ><th>Relay</th><th>State</th><th>Events</th><th>OK</th><th>Bytes</th
        ></tr
      >
    </thead>
    <tbody>
      {#each snapshots as snapshot (snapshot.url)}
        <tr>
          <td>{snapshot.url}</td>
          <td>{snapshot.state}</td>
          <td>{stats(snapshot).eventCount}</td>
          <td>
            {stats(snapshot).okAcceptedCount}/{stats(snapshot).okRejectedCount}
          </td>
          <td>{stats(snapshot).receivedBytes + stats(snapshot).sentBytes}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <h3>Subscriptions</h3>
  <ul>
    {#each snapshots as snapshot (snapshot.url)}
      {#each stats(snapshot).activeSubscriptionIds as id (`${snapshot.url}:${id}`)}
        <li><code>{id}</code> <span>{snapshot.url}</span></li>
      {/each}
    {/each}
  </ul>
  <h3>Persisted relay summaries</h3>
  <table class="stats-table">
    <thead>
      <tr
        ><th>Relay</th><th>Attempts</th><th>Events</th><th>Last event</th><th
          >Latency</th
        ></tr
      >
    </thead>
    <tbody>
      {#each summaries as summary (summary.relayUrl)}
        <tr>
          <td>{summary.relayUrl}</td>
          <td>
            {summary.attemptCount}/{summary.openCount}/{summary.errorCount}
          </td>
          <td>
            {summary.validEventCount} ok · {summary.invalidEventCount} invalid
          </td>
          <td>{summary.lastEventId ?? 'none'}</td>
          <td>
            {summary.firstMessageLatencyMs ?? '-'}ms first ·
            {summary.eoseLatencyMs ?? '-'}ms EOSE
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if jobHealth}
    <h3>Jobs</h3>
    <div class="stats-cards">
      <article>
        <strong>{jobHealth.total}</strong><span>stored jobs</span>
      </article>
      <article>
        <strong>{jobHealth.statusCounts.queued}</strong><span>queued</span>
      </article>
      <article>
        <strong>{jobHealth.statusCounts.running}</strong><span>running</span>
      </article>
      <article>
        <strong>{formatAge(jobHealth.oldestQueuedAgeMs)}</strong>
        <span>oldest queued</span>
      </article>
    </div>
    <p>
      latest failure {jobHealth.latestFailure?.error ?? 'none'} · stale startup
      {formatTime(jobHealth.latestStaleStartupMark?.staleStartedAt)}
    </p>
  {/if}
  <h3>Cache</h3>
  {#if cache}
    <p>
      {cache.rawEventCount} events, {cache.profileCount} profiles,
      {cache.notificationCount} notifications, {cache.storageEstimateBytes ?? 0}
      bytes
    </p>
  {/if}
</section>
