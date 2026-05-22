<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import EmojifiedText from '$lib/components/events/EmojifiedText.svelte';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';
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
    postCount: number;
    relayCount: number;
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let display = $derived(
    identityDisplay(props.pubkey, props.profile ?? undefined),
  );
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
    {#if props.profile?.website}
      <span>{props.profile.website}</span>
    {/if}
    {#if props.nprofile}<span>{props.nprofile}</span>{/if}
    <span>{props.postCount} loaded posts</span>
    <span>{props.relayCount} metadata relays</span>
  </div>
</header>
