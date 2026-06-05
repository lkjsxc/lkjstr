<script lang="ts">
  import { onDestroy } from 'svelte';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import { encodeNpub } from '$lib/protocol/nip19';
  import { followeeEntries, type FolloweeEntry } from '$lib/profile/followees';
  import { cachedProfileFollowList } from '$lib/profile/profile-store';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';

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
  let unavailable = $state('');
  let copied = $state('');
  let generation = 0;
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let relays = $derived(timelineRelays(props.relaySets));
  let runtimeKey = $derived(`${props.pubkey}|${relays.join('\u0000')}`);

  $effect(() => {
    if (!props.visible) return;
    const key = runtimeKey;
    if (!key) return;
    const run = ++generation;
    void loadFollowees(run);
  });

  onDestroy(() => {
    generation++;
    if (copyTimer) clearTimeout(copyTimer);
  });

  async function loadFollowees(run: number): Promise<void> {
    loading = true;
    unavailable = '';
    const followList = await cachedProfileFollowList(props.pubkey);
    if (run !== generation) return;
    entries = followeeEntries(followList);
    unavailable = followList
      ? entries.length === 0
        ? 'Follow list has no valid pubkeys.'
        : ''
      : 'No follow list has been received for this profile.';
    profiles = await hydrateProfiles({
      pubkeys: entries.slice(0, 120).map((entry) => entry.pubkey),
      relays,
      owner: props.tabId,
    });
    if (run === generation) loading = false;
  }

  async function copyNpub(pubkey: string): Promise<void> {
    const npub = safeNpub(pubkey);
    await navigator.clipboard?.writeText(npub);
    copied = pubkey;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      if (copied === pubkey) copied = '';
    }, 1200);
  }

  function safeNpub(pubkey: string): string {
    try {
      return encodeNpub(pubkey);
    } catch {
      return pubkey;
    }
  }
</script>

<section class="followees-tab" aria-label="Following">
  <header class="followees-tab__header">
    <h2>Following</h2>
    <p>{safeNpub(props.pubkey)}</p>
  </header>
  {#if loading}
    <p>Loading following list...</p>
  {:else if unavailable}
    <p>{unavailable}</p>
    <button type="button" onclick={() => void loadFollowees(++generation)}>
      Retry
    </button>
  {:else}
    <ul class="followees-list">
      {#each entries as entry (entry.pubkey)}
        {@const profile = profiles[entry.pubkey]}
        {@const display = identityDisplay(entry.pubkey, profile)}
        <li class="followees-row">
          <Avatar
            pubkey={entry.pubkey}
            name={display.title}
            src={display.avatarUrl}
            size="md"
          />
          <div class="followees-row__main">
            <strong>{display.title}</strong>
            <span>{display.subtitle}</span>
            {#if entry.petname}<small>Petname: {entry.petname}</small>{/if}
            {#if entry.relayUrl}<small>Relay: {entry.relayUrl}</small>{/if}
          </div>
          <div class="followees-row__actions">
            <button
              type="button"
              onclick={() => props.openProfile(entry.pubkey)}
            >
              Profile
            </button>
            <button
              type="button"
              onclick={() => props.openUserTimeline(entry.pubkey)}
            >
              Timeline
            </button>
            <button type="button" onclick={() => void copyNpub(entry.pubkey)}>
              Copy npub
            </button>
          </div>
          {#if copied === entry.pubkey}<span role="status">Copied</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
