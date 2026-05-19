<script lang="ts">
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { Account } from '$lib/accounts/account';
  import NpubMinerPanel from './NpubMinerPanel.svelte';

  type Props = {
    accounts: Account[];
    addReadonly: () => void;
    addNip07: () => void;
    addReadonlyPubkey: (pubkey: string) => Promise<void>;
  };

  let props: Props = $props();
</script>

<section class="data-tab">
  <h2>Accounts</h2>
  <div class="toolbar">
    <button type="button" onclick={props.addReadonly}>Add read-only</button>
    <button type="button" onclick={props.addNip07}>Add NIP-07</button>
  </div>
  <NpubMinerPanel addReadonlyPubkey={props.addReadonlyPubkey} />
  {#each props.accounts as account (account.id)}
    <article class="row">
      <IdentityChip pubkey={account.pubkey} />
      <small>{account.signerType}</small>
    </article>
  {:else}
    <p>No account records are stored.</p>
  {/each}
</section>
