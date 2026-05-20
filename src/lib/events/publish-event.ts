import { activeAccount } from '../accounts/account-store';
import { getNip07Provider } from '../accounts/nip07';
import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import { sharedRelayPool, type PublishResult } from '../relays/relay-pool';
import type { RelaySet } from '../relays/relay-store';
import { enabledWriteRelays } from '../timeline/timeline-subscription';
import { storeTimelineEvent } from '../timeline/timeline-store';

export type EventPublishStatus =
  | { ok: true; event: NostrEvent; results: PublishResult[] }
  | { ok: false; message: string };

export async function signAndPublish(
  build: (pubkey: string) => UnsignedNostrEvent,
  relaySets: readonly RelaySet[],
): Promise<EventPublishStatus> {
  const account = await activeAccount();
  if (!account) return { ok: false, message: 'Add a NIP-07 account first.' };
  if (account.signerType !== 'nip07')
    return { ok: false, message: 'Select a NIP-07 account that can sign.' };
  const provider = getNip07Provider();
  if (!provider) return { ok: false, message: 'NIP-07 signer unavailable.' };
  const relays = enabledWriteRelays(relaySets);
  if (relays.length === 0)
    return { ok: false, message: 'Enable at least one write relay.' };
  const event = await provider.signEvent(build(account.pubkey));
  await storeTimelineEvent(event);
  const results = await sharedRelayPool.publish(relays, event);
  return { ok: true, event, results };
}
