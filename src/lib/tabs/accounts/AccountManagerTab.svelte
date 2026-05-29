<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import {
    addAccountFromInput,
    addNip07Account,
    generateNsec,
    removeStoredAccount,
    setActiveAccount,
  } from '$lib/accounts/account-manager';
  import { getLocalSecret } from '$lib/accounts/local-secret-store';
  import { encodeNsec } from '$lib/protocol';
  import AccountRow from './AccountRow.svelte';
  import AccountStorageSafety from './AccountStorageSafety.svelte';

  type Props = {
    accounts: Account[];
    activeAccount?: Account;
    refreshData: () => void | Promise<void>;
  };

  let props: Props = $props();
  let input = $state('');
  let status = $state('');
  let busy = $state(false);
  let revealed = $state<Record<string, string>>({});

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

  function fillGeneratedNsec(): void {
    input = generateNsec();
    status = 'Generated nsec. Add it as a local account when ready.';
  }

  function makeActive(account: Account): Promise<void> {
    return run(() => setActiveAccount(account), 'Active account updated.');
  }

  function remove(account: Account): Promise<void> {
    return run(() => removeStoredAccount(account), 'Account disconnected.');
  }

  async function reveal(account: Account): Promise<void> {
    if (account.signerType !== 'local') return;
    const secret = await getLocalSecret(account.id);
    if (!secret) {
      status = 'Local secret is unavailable.';
      return;
    }
    revealed = { ...revealed, [account.id]: encodeNsec(secret.secretKey) };
  }

  async function copy(account: Account): Promise<void> {
    const nsec = revealed[account.id];
    if (!nsec) return;
    await navigator.clipboard?.writeText(nsec);
    status = 'Local nsec copied.';
  }
</script>

<section class="data-tab" aria-label="Accounts">
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
      id="account-input"
      name="account-input"
      placeholder="npub, hex pubkey, or nsec"
    />
    <button type="button" disabled={busy} onclick={fillGeneratedNsec}
      >Generate nsec</button
    >
    <button type="submit" disabled={busy || !input.trim()}>Add</button>
  </form>
  <div class="toolbar">
    <button type="button" disabled={busy} onclick={connectNip07}
      >Log in with NIP-07</button
    >
  </div>
  <AccountStorageSafety />
  {#if status}<p role="status">{status}</p>{/if}
  {#if props.accounts.length > 0}
    <fieldset>
      <legend>Active account</legend>
      {#each props.accounts as account (account.id)}
        <AccountRow
          {account}
          activeAccount={props.activeAccount}
          {busy}
          revealed={revealed[account.id]}
          makeActive={(item) => void makeActive(item)}
          reveal={(item) => void reveal(item)}
          copy={(item) => void copy(item)}
          remove={(item) => void remove(item)}
        />
      {/each}
    </fieldset>
  {:else}
    <p>No account records are stored.</p>
  {/if}
</section>
