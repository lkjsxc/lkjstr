<script lang="ts">
  import { onDestroy } from 'svelte';
  import { loadAuthorContext } from '$lib/author-context/author-context';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { sharedSubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tabId: string;
    visible?: boolean;
    restoreAnchor?: TabFeedAnchor;
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
  let destroyed = false;
  const subscriptions = sharedSubscriptionOrchestrator;

  $effect(() => {
    if (!props.visible) return;
    void load();
  });

  onDestroy(() => {
    destroyed = true;
    subscriptions.releaseOwner(props.tabId);
  });

  $effect(() => {
    if (!props.visible) return;
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
      if (!destroyed && id === requestId) profiles = { ...profiles, ...loaded };
    });
  });

  async function load(): Promise<void> {
    loading = true;
    error = '';
    try {
      const loaded = await loadAuthorContext({
        eventId: props.eventId,
        pubkey: props.pubkey,
        relays: timelineRelays(props.relaySets),
        owner: props.tabId,
        subscriptions,
      });
      if (destroyed) return;
      items = loaded;
    } catch (err) {
      if (destroyed) return;
      error = err instanceof Error ? err.message : 'Author context failed.';
    } finally {
      if (!destroyed) loading = false;
    }
  }
</script>

<section class="timeline-tab" aria-label="Author Context">
  {#if error}<p role="alert">{error}</p>{/if}
  <EventTreeList
    tabId={props.tabId}
    restoreAnchor={props.restoreAnchor}
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
