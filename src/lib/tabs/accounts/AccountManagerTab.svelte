<script lang="ts">
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { Account } from '$lib/accounts/account';
  import {
    addAccountFromInput,
    addNip07Account,
    createLocalAccount,
    removeStoredAccount,
    setActiveAccount,
  } from '$lib/accounts/account-manager';
  import { setAccountEnabled } from '$lib/accounts/account-store';

  type Props = {
    accounts: Account[];
    activeAccount?: Account;
    refreshData: () => void | Promise<void>;
  };

  let props: Props = $props();
  let input = $state('');
  let status = $state('');
  let busy = $state(false);

  async function run(
    action: () => Promise<unknown>,
    ok: string,
  ): Promise<void> {
    if (busy) return;
    busy = true;
    status = '';
    try {
      await action();
      status = ok;
      input = '';
      await props.refreshData();
    } catch (error) {
      status =
        error instanceof Error ? error.message : 'Account action failed.';
    } finally {
      busy = false;
    }
  }

  function addInput(): Promise<void> {
    return run(() => addAccountFromInput(input), 'Account added.');
  }

  function connectNip07(): Promise<void> {
    return run(() => addNip07Account(), 'NIP-07 account added.');
  }

  function createLocal(): Promise<void> {
    return run(() => createLocalAccount(), 'Local account created.');
  }

  function makeActive(account: Account): Promise<void> {
    return run(() => setActiveAccount(account), 'Active account updated.');
  }

  function toggleEnabled(account: Account): Promise<void> {
    return run(
      () => setAccountEnabled(account.id, !account.enabled),
      account.enabled ? 'Account disabled.' : 'Account enabled.',
    );
  }

  function remove(account: Account): Promise<void> {
    return run(() => removeStoredAccount(account), 'Account removed.');
  }
</script>

<section class="data-tab">
  <h2>Accounts</h2>
  <form
    class="toolbar"
    onsubmit={(event) => {
      event.preventDefault();
      void addInput();
    }}
  >
    <input
      aria-label="npub, hex pubkey, or nsec"
      bind:value={input}
      disabled={busy}
      placeholder="npub, hex pubkey, or nsec"
    />
    <button type="submit" disabled={busy || !input.trim()}>Add</button>
  </form>
  <div class="toolbar">
    <button type="button" disabled={busy} onclick={connectNip07}
      >Add NIP-07</button
    >
    <button type="button" disabled={busy} onclick={createLocal}
      >Create local</button
    >
  </div>
  {#if status}<p role="status">{status}</p>{/if}
  {#each props.accounts as account (account.id)}
    <article class:disabled={!account.enabled} class="row">
      <IdentityChip pubkey={account.pubkey} />
      <small>{account.signerType}</small>
      <small>{account.enabled ? 'enabled' : 'disabled'}</small>
      {#if props.activeAccount?.id === account.id}
        <strong>active</strong>
      {:else}
        <button
          type="button"
          disabled={busy || !account.enabled}
          onclick={() => makeActive(account)}
        >
          Set active
        </button>
      {/if}
      <button
        type="button"
        disabled={busy}
        onclick={() => toggleEnabled(account)}
      >
        {account.enabled ? 'Disable' : 'Enable'}
      </button>
      <button type="button" disabled={busy} onclick={() => remove(account)}>
        Remove from this device
      </button>
    </article>
  {:else}
    <p>No account records are stored.</p>
  {/each}
</section>
