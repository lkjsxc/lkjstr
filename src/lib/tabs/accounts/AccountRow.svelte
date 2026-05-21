<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';

  type Props = {
    account: Account;
    activeAccount?: Account;
    busy?: boolean;
    revealed?: string;
    passkeyUnlocked?: boolean;
    makeActive: (account: Account) => void;
    toggleEnabled: (account: Account) => void;
    reveal: (account: Account) => void;
    copy: (account: Account) => void;
    unlockPasskey: (account: Account) => void;
    lockPasskey: (account: Account) => void;
    remove: (account: Account) => void;
  };

  let props: Props = $props();
</script>

<article class:disabled={!props.account.enabled} class="row">
  <label>
    <input
      type="radio"
      name="active-account"
      checked={props.activeAccount?.id === props.account.id}
      disabled={props.busy || !props.account.enabled}
      onchange={() => props.makeActive(props.account)}
    />
    <IdentityChip pubkey={props.account.pubkey} />
  </label>
  <small>{props.account.signerType}</small>
  <small>{props.account.enabled ? 'enabled' : 'disabled'}</small>
  {#if props.account.signerType === 'passkey-local'}
    <small>{props.passkeyUnlocked ? 'unlocked' : 'locked'}</small>
  {/if}
  <button
    type="button"
    disabled={props.busy}
    onclick={() => props.toggleEnabled(props.account)}
  >
    {props.account.enabled ? 'Disable' : 'Enable'}
  </button>
  {#if props.account.signerType === 'local'}
    {#if props.revealed}
      <code>{props.revealed}</code>
      <button
        type="button"
        disabled={props.busy}
        onclick={() => props.copy(props.account)}
      >
        Copy nsec
      </button>
    {:else}
      <button
        type="button"
        disabled={props.busy}
        onclick={() => props.reveal(props.account)}
      >
        Reveal nsec
      </button>
    {/if}
  {:else if props.account.signerType === 'passkey-local'}
    {#if props.passkeyUnlocked}
      <button
        type="button"
        disabled={props.busy}
        onclick={() => props.lockPasskey(props.account)}
      >
        Lock
      </button>
    {:else}
      <button
        type="button"
        disabled={props.busy}
        onclick={() => props.unlockPasskey(props.account)}
      >
        Unlock
      </button>
    {/if}
  {/if}
  <button
    type="button"
    disabled={props.busy}
    onclick={() => props.remove(props.account)}
  >
    Disconnect
  </button>
</article>
