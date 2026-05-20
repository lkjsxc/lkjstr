<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import {
    loadFollowState,
    publishFollowMutation,
  } from '$lib/profile/profile-actions';
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    account?: Account;
    pubkey: string;
    relaySets: readonly RelaySet[];
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let following = $state(false);
  let status = $state('');
  let busy = $state(false);
  let ownProfile = $derived(props.account?.pubkey === props.pubkey);

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
</script>

<div class="profile-actions">
  {#if props.account && !ownProfile}
    <button type="button" disabled={busy} onclick={toggleFollow}>
      {following ? 'Unfollow' : 'Follow'}
    </button>
  {:else if ownProfile}
    <button type="button" onclick={props.openProfileEdit}>Edit profile</button>
  {/if}
  {#if status}<p role="status">{status}</p>{/if}
</div>
