<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import type { ProfileSummary } from '$lib/identity/identity';
  import {
    loadFollowState,
    publishFollowMutation,
    publishProfileMetadata,
  } from '$lib/profile/profile-actions';
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    account?: Account;
    pubkey: string;
    profile?: ProfileSummary | null;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let following = $state(false);
  let editing = $state(false);
  let name = $state('');
  let about = $state('');
  let status = $state('');
  let busy = $state(false);
  let ownProfile = $derived(props.account?.pubkey === props.pubkey);

  $effect(() => {
    name = props.profile?.name ?? props.profile?.displayName ?? '';
    about = props.profile?.about ?? '';
  });

  $effect(() => {
    if (!props.account || ownProfile) return;
    void loadFollowState(props.account.pubkey, props.pubkey).then(
      (value) => (following = value),
    );
  });

  async function toggleFollow(): Promise<void> {
    if (!props.account || busy) return;
    busy = true;
    const next = !following;
    const result = await publishFollowMutation(
      props.pubkey,
      next,
      props.relaySets,
    );
    busy = false;
    status = result.ok ? '' : result.message;
    if (result.ok) following = next;
  }

  async function saveProfile(): Promise<void> {
    if (busy) return;
    busy = true;
    const result = await publishProfileMetadata(
      { name, about },
      props.relaySets,
    );
    busy = false;
    status = result.ok ? 'Profile updated.' : result.message;
    if (result.ok) editing = false;
  }
</script>

<div class="profile-actions">
  {#if props.account && !ownProfile}
    <button type="button" disabled={busy} onclick={toggleFollow}>
      {following ? 'Unfollow' : 'Follow'}
    </button>
  {:else if ownProfile}
    <button type="button" disabled={busy} onclick={() => (editing = !editing)}>
      Edit profile
    </button>
  {/if}
  {#if editing}
    <label>
      Name
      <input bind:value={name} />
    </label>
    <label>
      About
      <textarea bind:value={about} rows="3"></textarea>
    </label>
    <button type="button" disabled={busy} onclick={saveProfile}>Save</button>
  {/if}
  {#if status}<p role="status">{status}</p>{/if}
</div>
