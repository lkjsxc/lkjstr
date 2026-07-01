import {
  addMinedLocalAccount,
  addNip07Account,
  importLocalNsec,
  addReadonlyAccount,
  addReadonlyPubkey,
} from '$lib/accounts/account-manager';
import { activeAccount, listAccounts } from '$lib/accounts/account-store';
import type { Account } from '$lib/accounts/account';
import {
  durableRelayReadPlan,
  unavailableRelayReadPlan,
  type EffectiveReadRelays,
} from '$lib/relays/read-availability';
import { listRelaySets, type RelaySet } from '$lib/relays/relay-store';
import {
  protectedStorageStateFromError,
  type ProtectedStorageState,
} from '$lib/storage/protected-storage-state';

export type WorkspacePageData = {
  readonly accounts: Account[];
  readonly activeAccount?: Account;
  readonly relaySets: RelaySet[];
  readonly relayReadPlan: EffectiveReadRelays;
  readonly storageState?: ProtectedStorageState;
};

type AccountLoad = {
  accounts: Account[];
  activeAccount?: Account;
  storageState?: ProtectedStorageState;
};

type RelayLoad = {
  relaySets: RelaySet[];
  relayReadPlan: EffectiveReadRelays;
  storageState?: ProtectedStorageState;
};

export async function loadWorkspacePageData(): Promise<WorkspacePageData> {
  const [account, relay] = await Promise.all([
    loadAccountData(),
    loadRelayData(),
  ]);
  return {
    accounts: account.accounts,
    activeAccount: account.activeAccount,
    relaySets: relay.relaySets,
    relayReadPlan: relay.relayReadPlan,
    storageState: account.storageState ?? relay.storageState,
  };
}

async function loadAccountData(): Promise<AccountLoad> {
  try {
    const accounts = await listAccounts();
    const active = await loadActiveAccount();
    return {
      accounts,
      activeAccount: active.account,
      storageState: active.state,
    };
  } catch (error) {
    const storageState = protectedStorageStateFromError(error);
    if (!storageState) throw error;
    return { accounts: [], storageState };
  }
}

async function loadActiveAccount(): Promise<{
  account?: Account;
  state?: ProtectedStorageState;
}> {
  try {
    return { account: await activeAccount() };
  } catch (error) {
    const state = protectedStorageStateFromError(error);
    if (!state) throw error;
    return { state };
  }
}

async function loadRelayData(): Promise<RelayLoad> {
  try {
    const relaySets = await listRelaySets();
    return { relaySets, relayReadPlan: durableRelayReadPlan(relaySets) };
  } catch (error) {
    const storageState = protectedStorageStateFromError(error);
    if (!storageState) throw error;
    return {
      relaySets: [],
      relayReadPlan: unavailableRelayReadPlan(storageState.reason, 'allowed'),
      storageState,
    };
  }
}

export async function addReadonlyFromInput(input: string): Promise<string> {
  await addReadonlyAccount(input);
  return 'Read-only account added.';
}

export async function addNip07FromProvider(): Promise<string> {
  await addNip07Account();
  return 'NIP-07 account added.';
}

export async function importNsecAccount(input: string): Promise<string> {
  await importLocalNsec(input);
  return 'Local account imported.';
}

export async function addReadonlyFromPubkey(pubkey: string): Promise<string> {
  await addReadonlyPubkey(pubkey);
  return 'Read-only account added.';
}

export async function addMinedSigningAccount(nsec: string): Promise<string> {
  await addMinedLocalAccount(nsec);
  return 'Mined signing account added.';
}
