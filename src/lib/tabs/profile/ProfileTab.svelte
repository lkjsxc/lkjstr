<script lang="ts">
  import EventContent from '$lib/components/events/EventContent.svelte';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import { shortNpub } from '$lib/identity/display-name';
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
  };

  let props: Props = $props();
  let state = $state<ProfileState>({
    profile: null,
    posts: [],
    loading: true,
    error: null,
    relays: [],
    updatedAt: null,
  });
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
</script>

<section class="profile-tab">
  <h2>Profile</h2>
  <header class="profile-card">
    <IdentityChip pubkey={props.pubkey} profile={state.profile ?? undefined} />
    <small>{shortNpub(props.pubkey)}</small>
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
  <div class="event-list">
    {#each state.posts as event (event.id)}
      <article class="event-row">
        <div class="event-main">
          <small>{new Date(event.created_at * 1000).toLocaleString()}</small>
          <EventContent content={event.content} />
        </div>
      </article>
    {:else}
      <p>No cached notes have been received for this profile.</p>
    {/each}
  </div>
</section>
