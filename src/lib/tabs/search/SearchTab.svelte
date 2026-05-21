<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { Account } from '$lib/accounts/account';
  import { feedPageSize } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { FeedEvent } from '$lib/events/types';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
  import { searchPage } from '$lib/search/search-query';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
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
  const subscriptions = new RelaySubscriptionManager();
  let defaultQuery = $derived(
    props.activeAccount?.displayName ||
      props.activeAccount?.nip05 ||
      props.activeAccount?.npub ||
      '',
  );

  $effect(() => {
    if (!query && defaultQuery) {
      query = defaultQuery;
      void runSearch();
    }
  });

  $effect(() => {
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
      if (id === requestId) profiles = { ...profiles, ...loaded };
    });
  });

  async function runSearch(): Promise<void> {
    const term = query.trim();
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
      items = page.items;
      hasOlder = page.hasOlder;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Search failed.';
    } finally {
      loading = false;
    }
  }

  async function loadOlder(): Promise<void> {
    if (loadingOlder || !hasOlder) return;
    const until = items.at(-1)?.event.created_at;
    if (!until) return;
    loadingOlder = true;
    try {
      const page = await searchPage({
        query,
        relays: timelineRelays(props.relaySets),
        subId: createTimelineSubId(props.tabId, 'search-old'),
        subscriptions,
        limit: feedPageSize,
        until,
      });
      items = merge(items, page.items);
      hasOlder = page.hasOlder;
    } finally {
      loadingOlder = false;
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
      .sort((a, b) => b.event.created_at - a.event.created_at);
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
    {items}
    {profiles}
    relaySets={props.relaySets}
    {loading}
    emptyText={searched ? 'No matching events.' : 'Enter a search query.'}
    {loadingOlder}
    loadingNewer={false}
    {hasOlder}
    hasNewer={false}
    onNearEnd={loadOlder}
    onNearStart={() => undefined}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
</section>
