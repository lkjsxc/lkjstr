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
  import { getLocalSecret } from '$lib/accounts/local-secret-store';
  import { encodeNsec } from '$lib/protocol';

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
  </div>
  {#if status}<p role="status">{status}</p>{/if}
  {#if props.accounts.length > 0}
    <fieldset>
      <legend>Active account</legend>
      {#each props.accounts as account (account.id)}
        <article class:disabled={!account.enabled} class="row">
          <label>
            <input
              type="radio"
              name="active-account"
              checked={props.activeAccount?.id === account.id}
              disabled={busy || !account.enabled}
              onchange={() => void makeActive(account)}
            />
            <IdentityChip pubkey={account.pubkey} />
          </label>
          <small>{account.signerType}</small>
          <small>{account.enabled ? 'enabled' : 'disabled'}</small>
          <button
            type="button"
            disabled={busy}
            onclick={() => toggleEnabled(account)}
          >
            {account.enabled ? 'Disable' : 'Enable'}
          </button>
          {#if account.signerType === 'local'}
            {#if revealed[account.id]}
              <code>{revealed[account.id]}</code>
              <button
                type="button"
                disabled={busy}
                onclick={() => copy(account)}
              >
                Copy nsec
              </button>
            {:else}
              <button
                type="button"
                disabled={busy}
                onclick={() => reveal(account)}
              >
                Reveal nsec
              </button>
            {/if}
          {/if}
          <button type="button" disabled={busy} onclick={() => remove(account)}>
            Disconnect
          </button>
        </article>
      {/each}
    </fieldset>
  {:else}
    <p>No account records are stored.</p>
  {/if}
</section>
