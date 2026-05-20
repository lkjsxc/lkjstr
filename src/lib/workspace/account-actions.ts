import {
  addMinedSigningAccount,
  addNip07FromProvider,
  addReadonlyFromPubkey,
  addReadonlyFromInput,
  createLocalSigningAccount,
  importNsecAccount,
} from './workspace-page-data';

export async function promptAddReadonly(refresh: () => Promise<void>) {
  const input = window.prompt('npub or hex pubkey');
  if (!input) return;
  try {
    await addReadonlyFromInput(input);
    await refresh();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Account add failed.',
    );
  }
}

export async function promptAddNip07(refresh: () => Promise<void>) {
  try {
    await addNip07FromProvider();
    await refresh();
  } catch {
    window.alert('NIP-07 unavailable.');
  }
}

export async function promptCreateLocal(refresh: () => Promise<void>) {
  try {
    await createLocalSigningAccount();
    await refresh();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Account create failed.',
    );
  }
}

export async function promptImportNsec(refresh: () => Promise<void>) {
  const input = window.prompt('nsec');
  if (!input) return;
  try {
    await importNsecAccount(input);
    await refresh();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Account import failed.',
    );
  }
}

export async function addMinedReadonly(
  pubkey: string,
  refresh: () => Promise<void>,
) {
  try {
    await addReadonlyFromPubkey(pubkey);
    await refresh();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Account add failed.',
    );
  }
}

export async function addMinedSigning(
  nsec: string,
  refresh: () => Promise<void>,
) {
  try {
    await addMinedSigningAccount(nsec);
    await refresh();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : 'Account add failed.',
    );
  }
}
