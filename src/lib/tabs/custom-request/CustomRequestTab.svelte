<script lang="ts">
  import { onDestroy } from 'svelte';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { parseCustomRequest } from '$lib/custom-request/parse';
  import { readCustomRequestEvents } from '$lib/custom-request/read';
  import { feedPageSize } from '$lib/events/feed-window';
  import { upsertEvent } from '$lib/events/repository';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { sharedSubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';
  import { progressiveStatusText } from '$lib/timeline/timeline-progressive';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tabId: string;
    restoreAnchor?: TabFeedAnchor;
    restoreSnapshot?: TabSnapshotPayload;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let input = $state('{"kinds":[1],"limit":30}');
  let items = $state<FeedEvent[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loading = $state(false);
  let error = $state('');
  let relayStatusText = $state('');
  let ran = $state(false);
  let requestId = 0;
  let destroyed = false;
  const subscriptions = sharedSubscriptionOrchestrator;

  $effect(() => {
    const saved = props.restoreSnapshot;
    if (saved?.kind !== 'feed') return;
    input = saved.filterState?.customRequestInput ?? input;
    ran = saved.filterState?.customRequestRan === 'true';
  });

  $effect(() =>
    registerTabRuntimeSnapshot(props.tabId, () => ({
      kind: 'feed',
      filterState: {
        customRequestInput: input,
        customRequestRan: String(ran),
      },
    })),
  );

  onDestroy(() => {
    destroyed = true;
    subscriptions.releaseOwner(props.tabId);
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
      `${props.tabId}:custom-profiles`,
    ).then((loaded) => {
      if (!destroyed && id === requestId) profiles = { ...profiles, ...loaded };
    });
  });

  async function run(): Promise<void> {
    loading = true;
    relayStatusText = '';
    error = '';
    ran = true;
    try {
      const request = parseCustomRequest(input);
      const relays = request.relays.length
        ? request.relays
        : timelineRelays(props.relaySets);
      const events = await readCustomRequestEvents({
        request,
        relays,
        owner: props.tabId,
        pageSize: feedPageSize,
        subscriptions,
        onSnapshot: (snapshot) => {
          if (destroyed) return;
          if (snapshot.items.length > 0) items = [...snapshot.items];
          relayStatusText = progressiveStatusText(snapshot.status);
        },
      });
      await Promise.all(
        events.map((item) => upsertEvent(item.event, item.relays)),
      );
      if (destroyed) return;
      items = events;
      relayStatusText = '';
    } catch (err) {
      if (destroyed) return;
      error = err instanceof Error ? err.message : 'Request failed.';
      items = [];
    } finally {
      if (!destroyed) loading = false;
    }
  }
</script>

<section class="timeline-tab" aria-label="Custom Request">
  <form
    class="toolbar"
    onsubmit={(event) => {
      event.preventDefault();
      void run();
    }}
  >
    <textarea aria-label="Custom request JSON" bind:value={input}></textarea>
    <button type="submit" disabled={loading || !input.trim()}>Run</button>
  </form>
  {#if error}<p role="alert">{error}</p>{/if}
  <EventTreeList
    tabId={props.tabId}
    restoreAnchor={props.restoreAnchor}
    {items}
    {profiles}
    relaySets={props.relaySets}
    {loading}
    {relayStatusText}
    emptyText={ran ? 'No events matched this request.' : 'Enter request JSON.'}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
