<script lang="ts">
  import { tick } from 'svelte';
  import EventRow from '$lib/components/events/EventRow.svelte';
  import { isNearEnd } from '$lib/events/feed-window';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { encodeNprofile, encodeNpub } from '$lib/protocol/nip19';
  import {
    ProfileRuntime,
    type ProfileState,
  } from '$lib/profile/profile-runtime';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
    pubkey: string;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
  };

  let props: Props = $props();
  let state = $state<ProfileState>({
    profile: null,
    posts: [],
    loading: true,
    error: null,
    relays: [],
    updatedAt: null,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    oldestCursor: undefined,
    newerPruned: false,
  });
  let profiles = $derived<Record<string, ProfileSummary>>(
    state.profile ? { [props.pubkey]: state.profile } : {},
  );
  let npub = $derived(safeNpub(props.pubkey));
  let nprofile = $derived(
    state.relays.length > 0 ? safeNprofile(props.pubkey, state.relays) : '',
  );
  let runtime: ProfileRuntime | undefined;
  let profileTab: HTMLElement | undefined;
  let autoFillPending = false;

  $effect(() => {
    runtime = new ProfileRuntime(
      props.pubkey,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId, 'profile'),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    return () => {
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
    <IdentityChip pubkey={props.pubkey} profile={state.profile ?? undefined} />
    <small>{npub}</small>
    {#if nprofile}<small>{nprofile}</small>{/if}
    {#if state.profile?.about}
      <p>{state.profile.about}</p>
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
