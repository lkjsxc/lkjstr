import { bech32 } from '@scure/base';
import { activeAccount } from '../accounts/account-store';
import { getNip07Provider } from '../accounts/nip07';
import type { ProfileSummary } from '../identity/identity';
import { kinds, zapRequestTags, type NostrEvent } from '../protocol';
import type { RelaySet } from '../relays/relay-store';
import { enabledWriteRelays } from '../timeline/timeline-subscription';

export type ZapInvoice = {
  readonly invoice: string;
  readonly uri: string;
};

export async function createZapInvoice(input: {
  event: NostrEvent;
  profile?: ProfileSummary;
  relaySets: readonly RelaySet[];
  amountSats: number;
  message: string;
}): Promise<ZapInvoice> {
  const account = await activeAccount();
  if (!account || account.signerType !== 'nip07')
    throw new Error('Add a NIP-07 account before zapping.');
  const provider = getNip07Provider();
  if (!provider) throw new Error('NIP-07 signer unavailable.');
  const lnurl = profileLnurl(input.profile);
  if (!lnurl) throw new Error('No Lightning address found for this event.');
  const pay = await fetchJson(lnurl);
  const callback = stringField(pay, 'callback');
  if (!callback) throw new Error('Lightning callback unavailable.');
  const amountMsats = Math.max(1, Math.floor(input.amountSats * 1000));
  const request = await provider.signEvent({
    pubkey: account.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: kinds.zapRequest,
    tags: zapRequestTags({
      event: input.event,
      amountMsats,
      relays: enabledWriteRelays(input.relaySets),
    }),
    content: input.message.trim(),
  });
  const invoice = await fetchJson(
    withInvoiceParams(callback, amountMsats, request),
  );
  const pr = stringField(invoice, 'pr');
  if (!pr) throw new Error('Lightning invoice unavailable.');
  return { invoice: pr, uri: `lightning:${pr}` };
}

function profileLnurl(profile?: ProfileSummary): string | undefined {
  if (profile?.lud16) {
    const [name, domain] = profile.lud16.split('@');
    if (name && domain) return `https://${domain}/.well-known/lnurlp/${name}`;
  }
  if (!profile?.lud06) return undefined;
  try {
    const decoded = bech32.decode(profile.lud06, 2000);
    return new TextDecoder().decode(
      Uint8Array.from(bech32.fromWords(decoded.words)),
    );
  } catch {
    return undefined;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Zap request failed: ${response.status}`);
  return response.json();
}

function withInvoiceParams(
  callback: string,
  amount: number,
  request: NostrEvent,
): string {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('nostr', JSON.stringify(request));
  return url.href;
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}
