<script lang="ts">
  import type { Account } from '$lib/accounts/account';
  import {
    addAccountFromInput,
    addNip07Account,
    createLocalAccount,
    createPasskeyLocalAccount,
    generateNsec,
    isPasskeyUnlocked,
    lockPasskeyAccount,
    loginWithPasskey,
    removeStoredAccount,
    setActiveAccount,
    unlockPasskeyAccount,
  } from '$lib/accounts/account-manager';
  import { getLocalSecret } from '$lib/accounts/local-secret-store';
  import { encodeNsec } from '$lib/protocol';
  import AccountRow from './AccountRow.svelte';

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

  function createLocal(): Promise<void> {
    return run(() => createLocalAccount(), 'Local account created.');
  }

  function fillGeneratedNsec(): void {
    input = generateNsec();
    status = 'Generated nsec. Create a local or passkey account from it.';
  }

  function createPasskey(): Promise<void> {
    return run(
      () => createPasskeyLocalAccount(input),
      'Passkey account created.',
    );
  }

  function loginPasskey(): Promise<void> {
    return run(() => loginWithPasskey(), 'Passkey account unlocked.');
  }

  function makeActive(account: Account): Promise<void> {
    return run(() => setActiveAccount(account), 'Active account updated.');
  }

  function remove(account: Account): Promise<void> {
    return run(() => removeStoredAccount(account), 'Account disconnected.');
  }

  function unlockPasskey(account: Account): Promise<void> {
    return run(
      () => unlockPasskeyAccount(account),
      'Passkey account unlocked.',
    );
  }

  async function lockPasskey(account: Account): Promise<void> {
    lockPasskeyAccount(account.id);
    status = 'Passkey account locked.';
    await props.refreshData();
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
    <button type="submit" disabled={busy || !input.trim()}>Add</button>
  </form>
  <div class="toolbar">
    <button type="button" disabled={busy} onclick={connectNip07}
      >Add NIP-07</button
    >
    <button type="button" disabled={busy} onclick={createLocal}
      >Create local</button
    >
    <button type="button" disabled={busy} onclick={fillGeneratedNsec}
      >Generate nsec</button
    >
    <button
      type="button"
      disabled={busy || !input.trim()}
      onclick={createPasskey}>Create passkey from nsec</button
    >
    <button type="button" disabled={busy} onclick={loginPasskey}
      >Login with passkey</button
    >
  </div>
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
          passkeyUnlocked={isPasskeyUnlocked(account.id)}
          makeActive={(item) => void makeActive(item)}
          reveal={(item) => void reveal(item)}
          copy={(item) => void copy(item)}
          unlockPasskey={(item) => void unlockPasskey(item)}
          lockPasskey={(item) => void lockPasskey(item)}
          remove={(item) => void remove(item)}
        />
      {/each}
    </fieldset>
  {:else}
    <p>No account records are stored.</p>
  {/if}
</section>
