<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import EventRow from '$lib/components/events/EventRow.svelte';
  import { isNearEnd } from '$lib/events/feed-window';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { getProfile } from '$lib/identity/profile-cache';
  import { profileUpdatedEvent } from '$lib/profile/profile-metadata-draft';
  import { encodeNprofile, encodeNpub } from '$lib/protocol/nip19';
  import {
    ProfileRuntime,
    type ProfileState,
  } from '$lib/profile/profile-runtime';
  import { emptyProfileState } from '$lib/profile/profile-state';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import ProfileActions from './ProfileActions.svelte';
  import ProfileAbout from './ProfileAbout.svelte';

  type Props = {
    tabId: string;
    pubkey: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let state = $state<ProfileState>(emptyProfileState());
  let profiles = $derived<Record<string, ProfileSummary>>(
    state.profile ? { [props.pubkey]: state.profile } : {},
  );
  let npub = $derived(safeNpub(props.pubkey));
  let nprofile = $derived(
    state.relays.length > 0 ? safeNprofile(props.pubkey, state.relays) : '',
  );
  let runtime: ProfileRuntime | undefined;
  let runtimeKey = $derived(
    `${props.pubkey}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  let profileTab: HTMLElement | undefined;
  let autoFillPending = false;

  $effect(() => {
    if (!runtimeKey) return;
    const { pubkey, relaySets, tabId } = untrack(() => props);
    runtime = new ProfileRuntime(
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
    if (shouldLoadOlder(el.scrollTop, el.clientHeight, el.scrollHeight))
      void runtime?.loadOlder();
  }

  function shouldLoadOlder(
    scrollTop: number,
    clientHeight: number,
    scrollHeight: number,
  ): boolean {
    return (
      Boolean(runtime) &&
      !state.loadingOlder &&
      state.hasOlder &&
      state.posts.length > 0 &&
      isNearEnd(scrollTop, clientHeight, scrollHeight)
    );
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
    const el = profileTab;
    if (el && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + 16)
      await runtime.loadOlder();
    autoFillPending = false;
  }
</script>

<section class="profile-tab" bind:this={profileTab} onscroll={handleScroll}>
  <h2>Profile</h2>
  <header class="profile-card">
    {#if state.profile?.bannerUrl}
      <img class="profile-card__banner" src={state.profile.bannerUrl} alt="" />
    {/if}
    <IdentityChip pubkey={props.pubkey} profile={state.profile ?? undefined} />
    <small>{npub}</small>
    <ProfileActions
      account={props.activeAccount}
      pubkey={props.pubkey}
      relaySets={props.relaySets}
      openProfileEdit={props.openProfileEdit}
    />
    {#if nprofile}<small>{nprofile}</small>{/if}
    {#if state.profile?.about}
      <ProfileAbout
        text={state.profile.about}
        emojis={state.profile.customEmojis ?? []}
      />
    {/if}
    {#if state.profile?.website}
      <span>{state.profile.website}</span>
    {/if}
    <small>{state.relays.length} metadata relays</small>
  </header>
  {#if state.loading}
    <p>Loading profile data...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <section
    class="profile-notes"
    aria-labelledby={`profile-notes-${props.tabId}`}
  >
    <h3 id={`profile-notes-${props.tabId}`}>Notes</h3>
    <div class="profile-notes__list">
      {#if state.posts.length > 0}
        {#each state.posts as item (item.event.id)}
          <EventRow
            {item}
            profile={profiles[item.event.pubkey]}
            relaySets={props.relaySets}
            openProfile={props.openProfile}
            openThread={props.openThread}
          />
        {/each}
      {:else if !state.loading}
        <p class="event-list__empty">
          No notes have been received for this profile.
        </p>
      {/if}
      {#if state.loadingOlder}
        <p class="event-list__status">Loading older notes...</p>
      {:else if state.hasOlder === false && state.posts.length > 0}
        <p class="event-list__status">End of loaded history.</p>
      {/if}
    </div>
  </section>
</section>
