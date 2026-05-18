import { activeAccount } from '../accounts/account-store';
import { getNip07Provider } from '../accounts/nip07';
import { kinds, type NostrEvent, type UnsignedNostrEvent } from '../protocol';
import { sharedRelayPool, type PublishResult } from '../relays/relay-pool';
import type { RelaySet } from '../relays/relay-store';
import { enabledWriteRelays } from '../timeline/timeline-subscription';
import { storeTimelineEvent } from '../timeline/timeline-store';

export type TweetPublishStatus =
  | { ok: true; event: NostrEvent; results: PublishResult[] }
  | { ok: false; message: string };

export async function publishTweet(
  content: string,
  relaySets: readonly RelaySet[],
): Promise<TweetPublishStatus> {
  const text = content.trim();
  if (!text) return { ok: false, message: 'Write a note before publishing.' };
  const account = await activeAccount();
  if (!account) return { ok: false, message: 'Add a NIP-07 account first.' };
  if (account.signerType !== 'nip07')
    return { ok: false, message: 'Select a NIP-07 account that can sign.' };
  const provider = getNip07Provider();
  if (!provider) return { ok: false, message: 'NIP-07 signer unavailable.' };
  const relays = enabledWriteRelays(relaySets);
  if (relays.length === 0)
    return { ok: false, message: 'Enable at least one write relay.' };
  const unsigned: UnsignedNostrEvent = {
    pubkey: account.pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: kinds.textNote,
    tags: [],
    content: text,
  };
  const event = await provider.signEvent(unsigned);
  await storeTimelineEvent(event);
  const results = await sharedRelayPool.publish(relays, event);
  return { ok: true, event, results };
}
