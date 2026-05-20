import { resolveActiveSigner } from '../accounts/signer';
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
  const signer = await resolveSigner();
  if (!signer.ok) return signer;
  const relays = enabledWriteRelays(relaySets);
  if (relays.length === 0)
    return { ok: false, message: 'Enable at least one write relay.' };
  const event = await signer.signEvent(build(signer.account.pubkey));
  await storeTimelineEvent(event);
  const results = await sharedRelayPool.publish(relays, event);
  return { ok: true, event, results };
}

async function resolveSigner() {
  try {
    return { ok: true as const, ...(await resolveActiveSigner()) };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'Signing failed.',
    };
  }
}
