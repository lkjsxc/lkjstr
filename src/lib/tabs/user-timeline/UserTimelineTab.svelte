<script lang="ts">
  import { onDestroy } from 'svelte';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import { encodeNpub } from '$lib/protocol/nip19';
  import { followeeEntries } from '$lib/profile/followees';
  import { cachedProfileFollowList } from '$lib/profile/profile-store';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    loadCachedTimeline,
    type TimelineItem,
  } from '$lib/timeline/timeline-store';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
    pubkey: string;
    visible?: boolean;
    activeAccountPubkey?: string | null;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let items = $state<TimelineItem[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loading = $state(true);
  let unavailable = $state('');
  let generation = 0;
  let relays = $derived(timelineRelays(props.relaySets));
  let runtimeKey = $derived(`${props.pubkey}|${relays.join('\u0000')}`);

  $effect(() => {
    if (!props.visible) return;
    const key = runtimeKey;
    if (!key) return;
    void loadTimeline(++generation);
  });

  onDestroy(() => {
    generation++;
  });

  async function loadTimeline(run: number): Promise<void> {
    loading = true;
    unavailable = '';
    const followList = await cachedProfileFollowList(props.pubkey);
    if (run !== generation) return;
    const authors = [
      props.pubkey,
      ...followeeEntries(followList).map((entry) => entry.pubkey),
    ];
    const uniqueAuthors = [...new Set(authors)];
    unavailable = followList
      ? ''
      : 'No follow list has been received for this user.';
    const [cached, hydrated] = await Promise.all([
      loadCachedTimeline(60, uniqueAuthors),
      hydrateProfiles({
        pubkeys: uniqueAuthors.slice(0, 120),
        relays,
        owner: props.tabId,
      }),
    ]);
    if (run !== generation) return;
    items = cached;
    profiles = hydrated;
    loading = false;
  }

  function safeNpub(pubkey: string): string {
    try {
      return encodeNpub(pubkey);
    } catch {
      return pubkey;
    }
  }
</script>

<section class="user-timeline-tab feed-tab" aria-label="User Timeline">
  <header class="user-timeline-tab__header">
    <h2>User Timeline</h2>
    <p>Public follow graph for {safeNpub(props.pubkey)}</p>
  </header>
  {#if unavailable}
    <p>{unavailable}</p>
    <button type="button" onclick={() => void loadTimeline(++generation)}>
      Retry
    </button>
  {/if}
  <EventTreeList
    tabId={props.tabId}
    pagingEnabled={props.visible !== false}
    {items}
    {profiles}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    {loading}
    emptyText="No cached posts are available for this user's follow graph."
    loadingOlder={false}
    loadingNewer={false}
    hasOlder={false}
    hasNewer={false}
    historyExhaustion="proven"
    olderLoadMode="explicit"
    olderPrefetchReady={false}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
