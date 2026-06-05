<script lang="ts">
  import { untrack } from 'svelte';
  import { captureStartupPromise } from '$lib/app/runtime-log';
  import type { Account } from '$lib/accounts/account';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import type { OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { getProfile } from '$lib/identity/profile-cache';
  import { profileUpdatedEvent } from '$lib/profile/profile-metadata-draft';
  import { encodeNprofile, encodeNpub } from '$lib/protocol/nip19';
  import {
    createProfileRuntime,
    type ProfileState,
    type ProfileRuntime,
  } from '$lib/profile/profile-runtime';
  import { emptyProfileState } from '$lib/profile/profile-state';
  import { followingCount } from '$lib/profile/profile-links';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { EventTreeListLeadingRow } from '$lib/components/events/event-tree-list-helpers';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import { feedRuntimeSnapshot } from '$lib/workspace/feed-runtime-snapshot';
  import ProfileHeader from './ProfileHeader.svelte';

  type Props = {
    tabId: string;
    visible?: boolean;
    restoreAnchor?: TabFeedAnchor;
    pubkey: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openFollowees: (pubkey: string) => void;
    openUserTimeline: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
    openProfileEdit: () => void;
  };

  function profileEmptyText(next: ProfileState): string {
    if (next.loading) return 'Loading notes...';
    if (next.error) return 'Profile notes are partially unavailable.';
    if (next.hasOlder) return 'Searching older notes...';
    return 'No public notes found on attempted relays.';
  }

  let props: Props = $props();
  let state = $state<ProfileState>(emptyProfileState());
  let profiles = $derived<Record<string, ProfileSummary>>(
    state.profile ? { [props.pubkey]: state.profile } : {},
  );
  let leadingRows = $derived<EventTreeListLeadingRow[]>([
    { key: 'profile-header', nearStart: true },
    ...(state.error ? [{ key: 'profile-error' }] : []),
  ]);
  let npub = $derived(safeNpub(props.pubkey));
  let nprofile = $derived(
    safeNprofile(props.pubkey, timelineRelays(props.relaySets)),
  );
  let runtime: ProfileRuntime | undefined;
  let olderRequests = createOlderRequestCoordinator<OlderLoadTrigger>(
    async (trigger) => {
      if (trigger === 'scroll') await runtime?.loadOlder({ preserve: 'older' });
      else await runtime?.loadOlder();
    },
    () => Boolean(state.hasOlder && !state.loadingOlder),
  );
  let runtimeKey = $derived(
    `${props.pubkey}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );

  $effect(() => {
    if (!props.visible) {
      runtime?.setVisibility?.(false);
      return;
    }
    runtime?.setVisibility?.(true);
    if (!runtimeKey) return;
    const { pubkey, relaySets, tabId } = untrack(() => props);
    olderRequests.reset();
    runtime = createProfileRuntime(
      pubkey,
      timelineRelays(relaySets),
      createTimelineSubId(tabId, 'profile'),
      tabId,
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    captureStartupPromise(runtime.start(), {
      code: 'profile-runtime-start-failed',
      surface: 'profile',
      kind: 'profile',
      tabId,
      relayCount: timelineRelays(relaySets).length,
    });
    const refreshProfile = (event: Event) => {
      if ((event as CustomEvent<string>).detail === props.pubkey)
        state = {
          ...state,
          profile: getProfile(props.pubkey) ?? state.profile,
        };
    };
    window.addEventListener(profileUpdatedEvent, refreshProfile);
    return () => {
      window.removeEventListener(profileUpdatedEvent, refreshProfile);
      unsubscribe();
      runtime?.close();
    };
  });

  function safeNpub(pubkey: string): string {
    try {
      return encodeNpub(pubkey);
    } catch {
      return pubkey;
    }
  }

  $effect(() => {
    const tabId = props.tabId;
    return registerTabRuntimeSnapshot(tabId, () =>
      feedRuntimeSnapshot({
        ...state,
        historyExhaustion: state.hasOlder ? 'unknown' : 'proven',
        eventIds: state.posts.map((item) => item.event.id),
      }),
    );
  });

  function safeNprofile(pubkey: string, relays: readonly string[]): string {
    try {
      return encodeNprofile({ pubkey, relays });
    } catch {
      return '';
    }
  }
</script>

<section class="profile-tab feed-tab" aria-label="Profile">
  <EventTreeList
    tabId={props.tabId}
    pagingEnabled={props.visible !== false}
    restoreAnchor={props.restoreAnchor}
    items={state.posts}
    {profiles}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccount?.pubkey}
    loading={state.loading}
    emptyText={profileEmptyText(state)}
    loadingOlder={state.loadingOlder}
    loadingNewer={state.loadingNewer}
    hasOlder={state.hasOlder}
    hasNewer={state.hasNewer}
    historyExhaustion={state.hasOlder ? 'unknown' : 'proven'}
    intentKey={runtimeKey}
    olderLoadMode="fill-then-user-scroll"
    olderPrefetchReady={Boolean(state.oldestCursor || state.newestCursor)}
    onNearEnd={(trigger) => olderRequests.requestFromNearEnd(trigger)}
    onNearStart={() => runtime?.loadNewer()}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
    {leadingRows}
  >
    {#snippet leadingRow(row)}
      {#if row.key === 'profile-header'}
        <ProfileHeader
          pubkey={props.pubkey}
          profile={state.profile}
          activeAccount={props.activeAccount}
          relaySets={props.relaySets}
          {npub}
          {nprofile}
          followList={state.followList}
          followingCount={followingCount(state.followList)}
          followListStatus={state.followListStatus}
          openFollowees={() => props.openFollowees(props.pubkey)}
          openUserTimeline={() => props.openUserTimeline(props.pubkey)}
          openProfileEdit={props.openProfileEdit}
        />
      {:else if row.key === 'profile-error'}
        <p role="alert">{state.error}</p>
      {/if}
    {/snippet}
  </EventTreeList>
</section>
