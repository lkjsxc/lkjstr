<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAuthorContext } from '$lib/author-context/author-context';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { RelaySubscriptionManager } from '$lib/relays/subscription-manager';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    eventId: string;
    pubkey: string;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let items = $state<FeedEvent[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loading = $state(true);
  let error = $state('');
  let requestId = 0;
  const subscriptions = new RelaySubscriptionManager();

  onMount(() => void load());

  $effect(() => {
    const pubkeys = [...new Set(items.map((item) => item.event.pubkey))].filter(
      (pubkey) => !profiles[pubkey],
    );
    if (pubkeys.length === 0) return;
    const id = ++requestId;
    void loadTimelineProfiles(
      pubkeys,
      timelineRelays(props.relaySets),
      `${props.tabId}:author-context-profiles`,
    ).then((loaded) => {
      if (id === requestId) profiles = { ...profiles, ...loaded };
    });
  });

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      items = await loadAuthorContext({
        eventId: props.eventId,
        pubkey: props.pubkey,
        relays: timelineRelays(props.relaySets),
        subId: createTimelineSubId(props.tabId, 'author'),
        subscriptions,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Author context failed.';
    } finally {
      loading = false;
    }
  }
</script>

<section class="timeline-tab" aria-label="Author Context">
  {#if error}<p role="alert">{error}</p>{/if}
  <EventTreeList
    {items}
    {profiles}
    relaySets={props.relaySets}
    {loading}
    emptyText="No nearby posts found."
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
