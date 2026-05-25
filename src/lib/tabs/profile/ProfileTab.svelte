<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import EventRow from '$lib/components/events/EventRow.svelte';
  import { isNearEnd, isNearStart } from '$lib/events/feed-window';
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
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import ProfileHeader from './ProfileHeader.svelte';
  import ProfileNewerButton from './ProfileNewerButton.svelte';

  type Props = {
    tabId: string;
    pubkey: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let state = $state<ProfileState>(emptyProfileState());
  let profiles = $derived<Record<string, ProfileSummary>>(
    state.profile ? { [props.pubkey]: state.profile } : {},
  );
  let npub = $derived(safeNpub(props.pubkey));
  let nprofile = $derived(
    safeNprofile(props.pubkey, timelineRelays(props.relaySets)),
  );
  let runtime: ProfileRuntime | undefined;
  let runtimeKey = $derived(
    `${props.pubkey}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  let profileTab: HTMLElement | undefined;
  let autoFillPending = false;
  let destroyed = false;

  $effect(() => {
    if (!runtimeKey) return;
    const { pubkey, relaySets, tabId } = untrack(() => props);
    runtime = createProfileRuntime(
      pubkey,
      timelineRelays(relaySets),
      createTimelineSubId(tabId, 'profile'),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    const refreshProfile = (event: Event) => {
      if ((event as CustomEvent<string>).detail === props.pubkey)
        state = {
          ...state,
          profile: getProfile(props.pubkey) ?? state.profile,
        };
    };
    window.addEventListener(profileUpdatedEvent, refreshProfile);
    return () => {
      destroyed = true;
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

  function safeNprofile(pubkey: string, relays: readonly string[]): string {
    try {
      return encodeNprofile({ pubkey, relays });
    } catch {
      return '';
    }
  }

  function handleScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (isNearStart(el.scrollTop) && state.hasNewer && !state.loadingNewer)
      void runtime?.loadNewer();
    if (shouldLoadOlder(el.scrollTop, el.clientHeight, el.scrollHeight))
      void runtime?.loadOlder();
  }

  function shouldLoadOlder(st: number, ch: number, sh: number): boolean {
    return Boolean(runtime) && !state.loadingOlder && state.hasOlder && state.posts.length > 0 && isNearEnd(st, ch, sh);
  }

  $effect(() => {
    if (
      !state.loading &&
      !state.loadingOlder &&
      state.hasOlder &&
      state.posts.length > 0
    )
      void maybeAutoFill();
  });

  async function maybeAutoFill(): Promise<void> {
    if (
      autoFillPending ||
      state.loading ||
      !runtime ||
      state.loadingOlder ||
      !state.hasOlder ||
      state.posts.length === 0
    )
      return;
    autoFillPending = true;
    await tick();
    if (destroyed) return;
    const el = profileTab;
    if (el && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + 16)
      await runtime.loadOlder();
    if (!destroyed) autoFillPending = false;
  }
</script>

<section
  class="profile-tab"
  aria-label="Profile"
  bind:this={profileTab}
  onscroll={handleScroll}
>
  <ProfileHeader
    pubkey={props.pubkey}
    profile={state.profile}
    activeAccount={props.activeAccount}
    relaySets={props.relaySets}
    {npub}
    {nprofile}
    followList={state.followList}
    followingCount={followingCount(state.followList)}
    openProfileEdit={props.openProfileEdit}
  />
  {#if state.loading}
    <p>Loading profile data...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <section class="profile-notes" aria-label="Notes">
    {#if state.hasNewer}
      <ProfileNewerButton
        loading={state.loadingNewer}
        load={() => runtime?.loadNewer()}
      />
    {/if}
    <div class="profile-notes__list">
      {#if state.posts.length > 0}
        {#each state.posts as item (item.event.id)}
          <EventRow
            {item}
            profile={profiles[item.event.pubkey]}
            relaySets={props.relaySets}
            activeAccountPubkey={props.activeAccount?.pubkey}
            openProfile={props.openProfile}
            openThread={props.openThread}
            openAuthorContext={props.openAuthorContext}
          />
        {/each}
      {:else if !state.loading}
        <p class="event-list__empty">
          No notes have been received for this profile.
        </p>
      {/if}
      {#if state.loadingOlder && state.hasOlder}
        <p class="event-list__status">Loading older notes...</p>
      {:else if state.hasOlder === false && state.posts.length > 0}
        <p class="event-list__status">End of loaded history.</p>
      {/if}
    </div>
  </section>
</section>
