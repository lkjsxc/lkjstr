<script lang="ts">
  import type { RuntimeMemorySnapshot } from '$lib/memory/runtime-memory';

  type Props = {
    memory: RuntimeMemorySnapshot | null;
  };

  let props: Props = $props();

  function countText(
    rows: readonly { readonly key: string; readonly count: number }[],
  ): string {
    return rows.length
      ? rows.map((row) => `${row.key}: ${row.count}`).join(' · ')
      : 'none';
  }
</script>

<h3>Runtime memory</h3>
{#if props.memory}
  <div class="stats-cards">
    <article>
      <strong>{props.memory.appLogCount}</strong><span>app logs</span>
    </article>
    <article>
      <strong>{props.memory.relaySuppressionCount}</strong>
      <span>relay suppressions</span>
    </article>
    <article>
      <strong>{props.memory.subscriptions.inFlightReads}</strong>
      <span>in-flight reads</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.activeDemands}</strong>
      <span>active demands</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.activeLeases}</strong>
      <span>active leases</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.liveLeases}</strong>
      <span>live leases</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.bootstrapLeases}</strong>
      <span>bootstrap/page reads</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.eventsReceived}</strong>
      <span>events received</span>
    </article>
    <article>
      <strong>{props.memory.orchestration.eventsAccepted}</strong>
      <span>events accepted</span>
    </article>
    <article>
      <strong>{props.memory.caches.contentTokens}</strong>
      <span>token cache</span>
    </article>
    <article>
      <strong>{props.memory.geometry.measuredRows}</strong>
      <span>feed geometry rows</span>
    </article>
    <article>
      <strong>{props.memory.geometry.activeReservations}</strong>
      <span>active row reservations</span>
    </article>
    <article>
      <strong>{props.memory.geometry.unloadPreservedRows}</strong>
      <span>unload-preserved rows</span>
    </article>
    <article>
      <strong>{props.memory.geometry.anchorCompensations}</strong>
      <span>anchor compensations</span>
    </article>
    <article>
      <strong>{props.memory.geometry.lastAnchorCompensationDeltaPx}</strong>
      <span>last anchor delta</span>
    </article>
    <article>
      <strong>{props.memory.geometry.staleObservationsDropped}</strong>
      <span>stale row observations</span>
    </article>
    <article>
      <strong>{props.memory.geometry.fragments.visibleFragments}</strong>
      <span>visible fragments</span>
    </article>
    <article>
      <strong>{props.memory.geometry.fragments.oversizedSemanticRows}</strong>
      <span>oversized semantic rows</span>
    </article>
    <article>
      <strong>{props.memory.geometry.bridgeStatus}</strong>
      <span>geometry bridge</span>
    </article>
    <article>
      <strong>{props.memory.geometry.rust.status}</strong>
      <span>Rust geometry diagnostics</span>
    </article>
    <article>
      <strong>{props.memory.geometry.rust.estimates}</strong>
      <span>Rust geometry estimates</span>
    </article>
    <article>
      <strong>{props.memory.geometry.rust.errors}</strong>
      <span>Rust geometry errors</span>
    </article>
    <article>
      <strong>{props.memory.userTimeline.status}</strong>
      <span>User Timeline diagnostics</span>
    </article>
  </div>
  {#if props.memory.geometry.rust.status === 'unavailable'}
    <p>{props.memory.geometry.rust.reason}</p>
  {/if}
  {#if props.memory.userTimeline.status === 'unavailable'}
    <p>{props.memory.userTimeline.reason}</p>
  {:else}
    <p>
      User Timeline statuses {countText(props.memory.userTimeline.outcomes)} · reasons
      {countText(props.memory.userTimeline.reasons)}
    </p>
  {/if}
  <p>
    fallback {props.memory.fallbackRepository.events} events · references
    {props.memory.caches.references} · profiles {props.memory.caches.profiles}
    · width buckets {countText(props.memory.geometry.widthBuckets)}
    {#if props.memory.jsHeap}
      · heap {props.memory.jsHeap.usedJSHeapSize}/{props.memory.jsHeap
        .jsHeapSizeLimit}
    {/if}
  </p>
{/if}
