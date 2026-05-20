import { bech32 } from '@scure/base';
import QRCode from 'qrcode';
import { activeAccount } from '../accounts/account-store';
import { getNip07Provider } from '../accounts/nip07';
import type { ProfileSummary } from '../identity/identity';
import {
  getProfile,
  profileFromMetadataEvent,
} from '../identity/profile-cache';
import { kinds, zapRequestTags, type NostrEvent } from '../protocol';
import type { RelaySet } from '../relays/relay-store';
import { sharedSubscriptionManager } from '../relays/subscription-manager';
import { enabledWriteRelays } from '../timeline/timeline-subscription';
import { readRelayPage } from './relay-page';
import { splitZapAmounts, zapTargets, type ZapTarget } from './zap-targets';

export type ZapInvoice = {
  readonly target: ZapTarget;
  readonly invoice: string;
  readonly uri: string;
  readonly qrDataUrl: string;
  readonly amountMsats: number;
};

export async function createZapInvoices(input: {
  event: NostrEvent;
  profile?: ProfileSummary;
  relaySets: readonly RelaySet[];
  amountSats: number;
  message: string;
}): Promise<ZapInvoice[]> {
  const account = await activeAccount();
  if (!account || account.signerType !== 'nip07')
    throw new Error('Add a NIP-07 account before zapping.');
  const provider = getNip07Provider();
  if (!provider) throw new Error('NIP-07 signer unavailable.');
  const relays = enabledWriteRelays(input.relaySets);
  const targets = zapTargets(input.event, input.profile);
  const amounts = splitZapAmounts(Math.floor(input.amountSats * 1000), targets);
  const invoices: ZapInvoice[] = [];
  for (const [index, target] of targets.entries()) {
    const amountMsats = amounts[index] ?? 0;
    if (amountMsats < 1000) continue;
    const lnurl = await targetLnurl(target, input.profile);
    const pay = await fetchJson(lnurl);
    validatePay(pay, amountMsats);
    const encodedLnurl = encodeLnurl(lnurl);
    const request = await provider.signEvent({
      pubkey: account.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: kinds.zapRequest,
      tags: zapRequestTags({
        event: input.event,
        recipientPubkey: target.pubkey,
        amountMsats,
        lnurl: encodedLnurl,
        relays,
      }),
      content: input.message.trim(),
    });
    const invoice = await fetchJson(
      withInvoiceParams(
        stringField(pay, 'callback')!,
        amountMsats,
        request,
        encodedLnurl,
      ),
    );
    const pr = stringField(invoice, 'pr');
    if (!pr) throw new Error('Lightning invoice unavailable.');
    invoices.push({
      target,
      invoice: pr,
      uri: `lightning:${pr}`,
      qrDataUrl: await QRCode.toDataURL(pr),
      amountMsats,
    });
  }
  if (invoices.length === 0) throw new Error('Zap amount is too small.');
  return invoices;
}

export async function createZapInvoice(
  input: Parameters<typeof createZapInvoices>[0],
): Promise<ZapInvoice> {
  return (await createZapInvoices(input))[0]!;
}

async function targetLnurl(
  target: ZapTarget,
  fallback?: ProfileSummary,
): Promise<string> {
  const profile =
    fallback?.pubkey === target.pubkey
      ? fallback
      : (getProfile(target.pubkey) ?? (await relayProfile(target)));
  const lnurl = profileLnurl(profile);
  if (!lnurl) throw new Error('No Lightning address found for zap target.');
  return lnurl;
}

async function relayProfile(
  target: ZapTarget,
): Promise<ProfileSummary | undefined> {
  if (target.relays.length === 0) return undefined;
  const [hit] = await readRelayPage({
    key: `zap-profile:${target.pubkey}`,
    relays: target.relays,
    filters: [{ kinds: [kinds.metadata], authors: [target.pubkey] }],
    pageSize: 1,
    subscriptions: sharedSubscriptionManager,
  });
  return hit ? profileFromMetadataEvent(hit.event) : undefined;
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

function validatePay(pay: unknown, amountMsats: number): void {
  if (stringField(pay, 'callback') === undefined)
    throw new Error('Lightning callback unavailable.');
  if (boolField(pay, 'allowsNostr') === false)
    throw new Error('Lightning endpoint does not support zap receipts.');
  const min = numberField(pay, 'minSendable');
  const max = numberField(pay, 'maxSendable');
  if ((min && amountMsats < min) || (max && amountMsats > max))
    throw new Error('Zap amount is outside the Lightning endpoint range.');
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
  lnurl: string,
): string {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amount));
  url.searchParams.set('nostr', JSON.stringify(request));
  url.searchParams.set('lnurl', lnurl);
  return url.href;
}

function encodeLnurl(url: string): string {
  return bech32.encode(
    'lnurl',
    bech32.toWords(new TextEncoder().encode(url)),
    2000,
  );
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field.length > 0 ? field : undefined;
}

function numberField(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'number' && Number.isFinite(field)
    ? field
    : undefined;
}

function boolField(value: unknown, key: string): boolean | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'boolean' ? field : undefined;
}
