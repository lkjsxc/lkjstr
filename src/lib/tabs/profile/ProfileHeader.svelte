<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import EmojifiedText from '$lib/components/events/EmojifiedText.svelte';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import {
    followListCopyJson,
    normalizedProfileWebsite,
    relaySetsCopyJson,
  } from '$lib/profile/profile-links';
  import type { RelaySet } from '$lib/relays/relay-store';
  import ProfileAbout from './ProfileAbout.svelte';
  import ProfileActions from './ProfileActions.svelte';

  type Props = {
    pubkey: string;
    profile: ProfileSummary | null;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    npub: string;
    nprofile: string;
    followList?: NostrEvent;
    followingCount: number;
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let display = $derived(
    identityDisplay(props.pubkey, props.profile ?? undefined),
  );
  let website = $derived(normalizedProfileWebsite(props.profile?.website));
  let copied = $state('');

  async function copy(label: string, value: string): Promise<void> {
    await navigator.clipboard?.writeText(value);
    copied = label;
    setTimeout(() => {
      if (copied === label) copied = '';
    }, 1200);
  }
</script>

<header class="profile-card">
  <div class="profile-card__banner-wrap">
    {#if props.profile?.bannerUrl}
      <img class="profile-card__banner" src={props.profile.bannerUrl} alt="" />
    {/if}
  </div>
  <div class="profile-card__main">
    <div class="profile-card__avatar">
      <Avatar
        pubkey={props.pubkey}
        name={display.title}
        src={display.avatarUrl}
        size="lg"
      />
    </div>
    <div class="profile-card__identity">
      <h2>
        <EmojifiedText
          text={display.title}
          emojis={props.profile?.customEmojis ?? []}
        />
      </h2>
      <p>{display.subtitle}</p>
      <small>{props.npub}</small>
    </div>
    <div class="profile-card__actions">
      <details class="profile-copy-menu">
        <summary aria-label="Profile copy menu">...</summary>
        <div class="profile-copy-menu__items">
          <button type="button" onclick={() => copy('npub', props.npub)}>
            Copy npub
          </button>
          <button
            type="button"
            disabled={!props.nprofile}
            onclick={() => copy('nprofile', props.nprofile)}
          >
            Copy nprofile
          </button>
          <button
            type="button"
            onclick={() =>
              copy('follow list', followListCopyJson(props.followList))}
          >
            Copy follow list JSON
          </button>
          <button
            type="button"
            onclick={() => copy('relays', relaySetsCopyJson(props.relaySets))}
          >
            Copy relay set JSON
          </button>
        </div>
      </details>
      <ProfileActions
        account={props.activeAccount}
        pubkey={props.pubkey}
        relaySets={props.relaySets}
        openProfileEdit={props.openProfileEdit}
      />
    </div>
  </div>
  {#if props.profile?.about}
    <ProfileAbout
      text={props.profile.about}
      emojis={props.profile.customEmojis ?? []}
    />
  {/if}
  <div class="profile-card__facts">
    {#if website}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a href={website} target="_blank" rel="noreferrer">
        {props.profile?.website}
      </a>
    {/if}
    {#if props.followingCount > 0}
      <span>{props.followingCount} following</span>
    {/if}
    {#if copied}<span role="status">Copied {copied}</span>{/if}
  </div>
</header>
