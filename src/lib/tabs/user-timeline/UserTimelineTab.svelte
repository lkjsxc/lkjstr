<script lang="ts">
  import { onDestroy } from 'svelte';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { sharedSubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import { safeNpub } from '$lib/components/identity/user-event-row';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';
  import { mergeUserTimelineItems } from '$lib/user-timeline/user-timeline-cache';
  import { readOlderUserTimeline } from '$lib/user-timeline/user-timeline-loaders';
  import {
    runUserTimelineRuntime,
    type UserTimelineRuntimeInput,
  } from '$lib/user-timeline/user-timeline-runtime';
  import type { UserTimelineSnapshot } from '$lib/user-timeline/user-timeline-state';
  import type { TimelineItem } from '$lib/timeline/timeline-store';

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
  let loadingOlder = $state(false);
  let hasOlder = $state(false);
  let notice = $state('Discovering public follow graph...');
  let error = $state<string | null>(null);
  let relayStatusText = $state('');
  let authors = $state<string[]>([]);
  let generation = 0;
  let startedKey = '';
  let hydrateRun = 0;
  let controller: AbortController | undefined;
  const subscriptions = sharedSubscriptionOrchestrator;
  let relays = $derived(timelineRelays(props.relaySets));
  let runtimeKey = $derived(`${props.pubkey}|${relays.join('\u0000')}`);

  $effect(() => {
    if (!props.visible) return;
    const key = runtimeKey;
    if (!key || key === startedKey) return;
    startedKey = key;
    void start(++generation);
  });

  onDestroy(() => {
    generation++;
    controller?.abort();
    subscriptions.releaseOwner(props.tabId);
  });

  async function start(run: number): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    const input: UserTimelineRuntimeInput = {
      targetPubkey: props.pubkey,
      relays,
      owner: props.tabId,
      subscriptions,
      signal: controller.signal,
      onSnapshot: (snapshot) => applySnapshot(run, snapshot),
    };
    await runUserTimelineRuntime(input);
  }

  function applySnapshot(run: number, snapshot: UserTimelineSnapshot): void {
    if (run !== generation) return;
    items = [...snapshot.items];
    authors = [...snapshot.authors];
    loading = snapshot.loading;
    loadingOlder = snapshot.loadingOlder;
    hasOlder = snapshot.hasOlder;
    notice = snapshot.notice;
    relayStatusText = snapshot.relayStatusText;
    error = snapshot.error;
    void hydrateVisibleAuthors();
  }

  async function hydrateVisibleAuthors(): Promise<void> {
    const visible = items.map((item) => item.event.pubkey);
    const pubkeys = [...new Set([...visible, ...authors])]
      .filter((pubkey) => !profiles[pubkey])
      .slice(0, 80);
    if (pubkeys.length === 0) return;
    const run = ++hydrateRun;
    const loaded = await loadTimelineProfiles(
      pubkeys,
      relays,
      `${props.tabId}:user-timeline-profiles`,
    );
    if (run === hydrateRun) profiles = { ...profiles, ...loaded };
  }

  async function loadOlder(): Promise<void> {
    if (loadingOlder || !hasOlder || !controller) return;
    loadingOlder = true;
    try {
      const page = await readOlderUserTimeline({
        items,
        authors,
        relays,
        owner: props.tabId,
        subscriptions,
        signal: controller.signal,
      });
      if (!page) return;
      items = mergeUserTimelineItems({
        current: items,
        incoming: page.items,
        limit: items.length + page.items.length,
      });
      hasOlder = page.hasOlder;
      void hydrateVisibleAuthors();
    } finally {
      loadingOlder = false;
    }
  }
</script>

<section class="user-timeline-tab feed-tab" aria-label="User Timeline">
  <header class="user-timeline-tab__header">
    <h2>User Timeline</h2>
    <p>Public timeline for {safeNpub(props.pubkey)}</p>
  </header>
  {#if notice}<p>{notice}</p>{/if}
  {#if error}
    <p role="alert">{error}</p>
    <button type="button" onclick={() => void start(++generation)}>Retry</button
    >
  {/if}
  <EventTreeList
    tabId={props.tabId}
    pagingEnabled={props.visible !== false}
    {items}
    {profiles}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    {loading}
    {relayStatusText}
    emptyText="No public posts are available for this timeline."
    {loadingOlder}
    loadingNewer={false}
    {hasOlder}
    hasNewer={false}
    historyExhaustion={hasOlder ? 'unknown' : 'proven'}
    olderLoadMode="auto-near-end"
    olderPrefetchReady={items.length > 0}
    onNearEnd={() => void loadOlder()}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
