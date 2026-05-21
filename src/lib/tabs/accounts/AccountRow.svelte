<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';

  type Props = {
    account: Account;
    activeAccount?: Account;
    busy?: boolean;
    revealed?: string;
    makeActive: (account: Account) => void;
    reveal: (account: Account) => void;
    copy: (account: Account) => void;
    remove: (account: Account) => void;
  };

  let props: Props = $props();
</script>

<article class="row">
  <label>
    <input
      type="radio"
      name="active-account"
      checked={props.activeAccount?.id === props.account.id}
      disabled={props.busy}
      onchange={() => props.makeActive(props.account)}
    />
    <IdentityChip pubkey={props.account.pubkey} />
  </label>
  <small>{props.account.signerType}</small>
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
  {/if}
  <button
    type="button"
    disabled={props.busy}
    onclick={() => props.remove(props.account)}
  >
    Disconnect
  </button>
</article>
