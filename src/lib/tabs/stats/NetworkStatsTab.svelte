<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
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
  import type { RelaySnapshot } from '$lib/relays/types';
  import {
    runtimeMemorySnapshot,
    type RuntimeMemorySnapshot,
  } from '$lib/memory/runtime-memory';
  import { readRuntimeDiagnostics } from '$lib/memory/runtime-diagnostics';
  import {
    readSqliteStorageHealth,
    type SqliteStorageHealthStatus,
  } from '$lib/storage/sqlite-opfs/storage-health';
  import JobHealthPanel from './JobHealthPanel.svelte';
  import NetworkStatsTables from './NetworkStatsTables.svelte';
  import RuntimeCounters from './RuntimeCounters.svelte';
  import RuntimeMemoryPanel from './RuntimeMemoryPanel.svelte';
  import CacheActions from './CacheActions.svelte';
  import CacheStatusPanel from './CacheStatusPanel.svelte';
  import StorageHealthPanel from './StorageHealthPanel.svelte';
  import OptimizerPanel from './OptimizerPanel.svelte';
  import { feedScanHintSnapshot } from '$lib/events/feed-scan-hints';
  import { relayReadScoreSnapshot } from '$lib/relays/relay-read-score';
  import {
    readScanOptimizerDebugSnapshot,
    type ScanOptimizerDebugSnapshot,
  } from '$lib/feed-surface/scan-model-debug';
  import { totalStats } from './relay-totals';

  let snapshots = $state<RelaySnapshot[]>([]);
  let memory = $state<RuntimeMemorySnapshot>(runtimeMemorySnapshot());
  let summaries = $state<RelayDiagnosticSummary[]>([]);
  let jobHealth = $state<JobHealthSummary | null>(null);
  let cache = $state<CacheMetadata | null>(null);
  let storageHealth = $state<SqliteStorageHealthStatus | null>(null);
  let optimizerScores = $state(relayReadScoreSnapshot());
  let scanHints = $state(feedScanHintSnapshot());
  let scanDebug = $state<ScanOptimizerDebugSnapshot | null>(null);
  let autoRefresh = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let disposed = false,
    refreshSeq = 0;
  let totals = $derived(totalStats(snapshots));

  onMount(() => void refresh());
  onDestroy(() => {
    disposed = true;
    stopAutoRefresh();
  });

  async function refresh(): Promise<void> {
    const seq = ++refreshSeq;
    snapshots = currentRelaySnapshots();
    const currentMemory = runtimeMemorySnapshot();
    memory = currentMemory;
    optimizerScores = relayReadScoreSnapshot();
    scanHints = feedScanHintSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (disposed || seq !== refreshSeq) return;
    const next = await Promise.all([
      safeRead(() => listRelayDiagnosticSummaries(), summaries),
      safeRead(() => loadJobHealthSummary(), jobHealth),
      safeRead(() => cacheStatus(), cache),
      safeRead(() => readSqliteStorageHealth(), storageHealth),
      safeRead(() => readScanOptimizerDebugSnapshot(), scanDebug),
      safeRead(() => readRuntimeDiagnostics(currentMemory), currentMemory),
    ]);
    if (disposed || seq !== refreshSeq) return;
    [summaries, jobHealth, cache, storageHealth, scanDebug] = next;
    memory = next[5];
  }

  async function safeRead<T>(read: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await read();
    } catch {
      return fallback;
    }
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
</script>

<FormTabShell label="Stats" class="data-tab stats-tab">
  <header class="settings-header">
    <div class="settings-actions">
      <CacheActions {cache} {refresh} />
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
  <NetworkStatsTables {snapshots} {summaries} />
  <JobHealthPanel {jobHealth} />
  <CacheStatusPanel {cache} />
  <StorageHealthPanel status={storageHealth} />
  <OptimizerPanel scores={optimizerScores} hints={scanHints} {scanDebug} />
  <RuntimeCounters />
  <RuntimeMemoryPanel {memory} />
</FormTabShell>
