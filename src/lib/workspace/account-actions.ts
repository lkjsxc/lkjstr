import {
  addNip07FromProvider,
  addReadonlyFromInput,
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
