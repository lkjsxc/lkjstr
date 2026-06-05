<script lang="ts">
  import { onDestroy } from 'svelte';
  import FeedScrollSurface from '$lib/components/feed/FeedScrollSurface.svelte';
  import UserEventRow from '$lib/components/identity/UserEventRow.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import { sharedSubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import { safeNpub } from '$lib/components/identity/user-event-row';
  import type { FolloweeEntry } from '$lib/profile/followees';
  import {
    runTargetFollowListRuntime,
    type TargetFollowListRuntimeInput,
  } from '$lib/follow-graph/target-follow-list-runtime';
  import type { TargetFollowListSnapshot } from '$lib/follow-graph/target-follow-list-state';

  type Props = {
    tabId: string;
    pubkey: string;
    visible?: boolean;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openUserTimeline: (pubkey: string) => void;
  };

  let props: Props = $props();
  let entries = $state<FolloweeEntry[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loading = $state(true);
  let message = $state('');
  let copied = $state('');
  let generation = 0;
  let startedKey = '';
  let controller: AbortController | undefined;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let hydrateRun = 0;
  const subscriptions = sharedSubscriptionOrchestrator;
  let relays = $derived(timelineRelays(props.relaySets));
  let runtimeKey = $derived(`${props.pubkey}|${relays.join('\u0000')}`);

  $effect(() => {
    if (!props.visible) return;
    const key = runtimeKey;
    if (!key || key === startedKey) return;
    startedKey = key;
    void startFollowees(++generation);
  });

  onDestroy(() => {
    generation++;
    controller?.abort();
    subscriptions.releaseOwner(props.tabId);
    if (copyTimer) clearTimeout(copyTimer);
  });

  async function startFollowees(run: number): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    loading = true;
    message = 'Discovering public follow list...';
    const input: TargetFollowListRuntimeInput = {
      targetPubkey: props.pubkey,
      selectedReadRelays: relays,
      owner: props.tabId,
      surface: 'followees',
      subscriptions,
      signal: controller.signal,
      allowDiscoveryFallback: true,
      onSnapshot: (snapshot) => applySnapshot(run, snapshot),
    };
    const final = await runTargetFollowListRuntime(input);
    if (run === generation) applySnapshot(run, final, true);
  }

  function applySnapshot(
    run: number,
    snapshot: TargetFollowListSnapshot,
    final = false,
  ): void {
    if (run !== generation) return;
    entries = [...snapshot.entries];
    message = snapshot.message;
    loading = !final && snapshot.entries.length === 0;
    if (snapshot.entries.length > 0) void hydrateWindow(0);
  }

  async function hydrateWindow(offset: number): Promise<void> {
    const start = Math.max(0, Math.floor(offset / 96) - 10);
    const pubkeys = entries
      .slice(start, start + 90)
      .map((entry) => entry.pubkey)
      .filter((pubkey) => !profiles[pubkey]);
    if (pubkeys.length === 0) return;
    const run = ++hydrateRun;
    const loaded = await hydrateProfiles({
      pubkeys,
      relays,
      owner: props.tabId,
    });
    if (run === hydrateRun) profiles = { ...profiles, ...loaded };
  }

  async function copyNpub(pubkey: string): Promise<void> {
    await navigator.clipboard?.writeText(safeNpub(pubkey));
    copied = pubkey;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      if (copied === pubkey) copied = '';
    }, 1200);
  }
</script>

<section class="followees-tab timeline-tab" aria-label="Following">
  <header class="followees-tab__header">
    <h2>Following</h2>
    <p>{safeNpub(props.pubkey)}</p>
  </header>
  {#if message}<p class="timeline-tab__guidance">{message}</p>{/if}
  {#if entries.length === 0 && !loading}
    <button type="button" onclick={() => void startFollowees(++generation)}>
      Retry
    </button>
  {/if}
  <div class="event-list">
    {#if entries.length > 0}
      <FeedScrollSurface
        data={entries}
        getKey={(item: unknown) => (item as FolloweeEntry).pubkey}
        scrollerClass="event-list__scroller"
        viewportClass="event-list__viewport"
        onScrollOffset={(offset) => void hydrateWindow(offset)}
      >
        {#snippet row(item: unknown)}
          {@const entry = item as FolloweeEntry}
          <UserEventRow
            pubkey={entry.pubkey}
            profile={profiles[entry.pubkey]}
            context={{ petname: entry.petname, relayUrl: entry.relayUrl }}
            copied={copied === entry.pubkey}
            openProfile={props.openProfile}
            openUserTimeline={props.openUserTimeline}
            {copyNpub}
          />
        {/snippet}
      </FeedScrollSurface>
    {:else}
      <p class="event-list__empty">
        {loading ? 'Loading following list...' : message}
      </p>
    {/if}
  </div>
</section>
