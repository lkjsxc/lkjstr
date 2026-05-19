<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
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

  $effect(() => {
    runtime = new ProfileRuntime(
      props.pubkey,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId),
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
</script>

<section class="profile-tab">
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
  <h3>Notes</h3>
  <EventTreeList
    items={state.posts}
    {profiles}
    loading={state.loading}
    loadingOlder={state.loadingOlder}
    hasOlder={state.hasOlder}
    onNearEnd={() => runtime?.loadOlder()}
    openProfile={props.openProfile}
    openThread={props.openThread}
    emptyText="No notes have been received for this profile."
  />
</section>
