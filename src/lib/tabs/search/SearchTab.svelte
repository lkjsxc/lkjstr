<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { cursorPoint, feedPageSize } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { FeedEvent } from '$lib/events/types';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { createRelaySubscriptionManager } from '$lib/relays/subscription-manager';
  import { searchPage } from '$lib/search/search-query';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    visible?: boolean;
    restoreAnchor?: { readonly eventId: string; readonly offset: number };
    restoreSnapshot?: TabSnapshotPayload;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let query = $state('');
  let items = $state<FeedEvent[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loading = $state(false);
  let loadingOlder = $state(false);
  let hasOlder = $state(false);
  let error = $state<string | null>(null);
  let searched = $state(false);
  let requestId = 0;
  let destroyed = false;
  const subscriptions = createRelaySubscriptionManager();
  const olderRequests = createOlderRequestCoordinator(
    () => loadOlder(),
    () => Boolean(hasOlder && !loadingOlder),
  );

  $effect(() => {
    const saved = props.restoreSnapshot;
    if (saved?.kind === 'tool' && saved.fields?.searchQuery)
      query = saved.fields.searchQuery;
  });

  $effect(() => {
    const tabId = props.tabId;
    return registerTabRuntimeSnapshot(tabId, () => ({
      kind: 'tool',
      fields: { searchQuery: query },
    }));
  });

  onDestroy(() => {
    destroyed = true;
    subscriptions.close();
  });

  $effect(() => {
    if (!props.visible) return;
    const pubkeys = [...new Set(items.map((item) => item.event.pubkey))].filter(
      (pubkey) => !profiles[pubkey],
    );
    if (pubkeys.length === 0) return;
    const id = ++requestId;
    void loadTimelineProfiles(
      pubkeys.slice(0, 30),
      timelineRelays(props.relaySets),
      `${props.tabId}:search-profiles`,
    ).then((loaded) => {
      if (!destroyed && id === requestId) profiles = { ...profiles, ...loaded };
    });
  });

  async function runSearch(): Promise<void> {
    const term = query.trim();
    if (!term) return;
    searched = true;
    loading = true;
    error = null;
    try {
      const page = await searchPage({
        query: term,
        relays: timelineRelays(props.relaySets),
        subId: createTimelineSubId(props.tabId, 'search'),
        subscriptions,
        limit: feedPageSize,
      });
      if (destroyed) return;
      items = page.items;
      hasOlder = page.hasOlder;
    } catch (err) {
      if (destroyed) return;
      error = err instanceof Error ? err.message : 'Search failed.';
    } finally {
      if (!destroyed) loading = false;
    }
  }

  async function loadOlder(): Promise<void> {
    if (loadingOlder || !hasOlder) return;
    const before = cursorPoint(items.at(-1));
    if (!before) return;
    loadingOlder = true;
    try {
      const page = await searchPage({
        query,
        relays: timelineRelays(props.relaySets),
        subId: createTimelineSubId(props.tabId, 'search-old'),
        subscriptions,
        limit: feedPageSize,
        before,
      });
      if (destroyed) return;
      items = merge(items, page.items);
      hasOlder = page.hasOlder;
    } finally {
      if (!destroyed) loadingOlder = false;
    }
  }

  function merge(current: FeedEvent[], incoming: readonly FeedEvent[]) {
    const ids: string[] = [];
    return [...current, ...incoming]
      .filter((item) => {
        if (ids.includes(item.event.id)) return false;
        ids.push(item.event.id);
        return true;
      })
      .sort((a, b) =>
        b.event.created_at === a.event.created_at
          ? a.event.id.localeCompare(b.event.id)
          : b.event.created_at - a.event.created_at,
      );
  }
</script>

<section class="timeline-tab" aria-label="Search">
  <form
    class="toolbar"
    onsubmit={(event) => {
      event.preventDefault();
      void runSearch();
    }}
  >
    <input aria-label="Search query" bind:value={query} />
    <button type="submit" disabled={loading || !query.trim()}>Search</button>
  </form>
  {#if error}<p role="alert">{error}</p>{/if}
  <EventTreeList
    tabId={props.tabId}
    pagingEnabled={props.visible !== false}
    restoreAnchor={props.restoreAnchor}
    {items}
    {profiles}
    relaySets={props.relaySets}
    {loading}
    emptyText={searched ? 'No matching events.' : 'Enter a search query.'}
    {loadingOlder}
    loadingNewer={false}
    {hasOlder}
    hasNewer={false}
    pagingError={error}
    onNearEnd={() => olderRequests.requestFromNearEnd()}
    onNearStart={() => undefined}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
