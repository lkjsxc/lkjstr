import { resolveActiveSigner } from '../accounts/signer';
import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import { clientTaggedEvent } from './publish-client-tag';
import { sharedRelayPool, type PublishResult } from '../relays/relay-pool';
import type { RelaySet } from '../relays/relay-store';
import { enabledWriteRelays } from '../timeline/timeline-subscription';
import { storeTimelineEvent } from '../timeline/timeline-store';

export type EventPublishStatus =
  | {
      ok: true;
      event: NostrEvent;
      results: PublishResult[];
      archiveWarning?: string;
    }
  | { ok: false; message: string };

export type EventQueuedPublishStatus =
  | {
      ok: true;
      event: NostrEvent;
      delivery: Promise<PublishResult[]>;
      archiveWarning?: string;
    }
  | { ok: false; message: string };

export async function signAndPublish(
  build: (pubkey: string) => UnsignedNostrEvent,
  relaySets: readonly RelaySet[],
): Promise<EventPublishStatus> {
  const queued = await signAndStartPublishing(build, relaySets);
  if (!queued.ok) return queued;
  let results: PublishResult[];
  try {
    results = await queued.delivery;
  } catch (error) {
    return {
      ok: false,
      message: publishErrorMessage(error, 'Relay publishing failed.'),
    };
  }
  if (results.every((result) => !result.accepted))
    return { ok: false, message: 'All relays rejected the event.' };
  return {
    ok: true,
    event: queued.event,
    results,
    archiveWarning: queued.archiveWarning,
  };
}

export async function signAndStartPublishing(
  build: (pubkey: string) => UnsignedNostrEvent,
  relaySets: readonly RelaySet[],
): Promise<EventQueuedPublishStatus> {
  const signer = await resolveSigner();
  if (!signer.ok) return signer;
  const relays = enabledWriteRelays(relaySets);
  if (relays.length === 0)
    return { ok: false, message: 'Enable at least one write relay.' };
  let event: NostrEvent;
  try {
    const unsigned = await clientTaggedEvent(build(signer.account.pubkey));
    event = await signer.signEvent(unsigned);
  } catch (error) {
    return {
      ok: false,
      message: publishErrorMessage(error, 'Signing failed.'),
    };
  }
  let delivery: Promise<PublishResult[]>;
  try {
    delivery = sharedRelayPool.publish(relays, event);
  } catch (error) {
    return {
      ok: false,
      message: publishErrorMessage(error, 'Relay publishing failed.'),
    };
  }
  const archiveWarning = await archiveSignedEvent(event);
  return { ok: true, event, delivery, archiveWarning };
}

async function archiveSignedEvent(
  event: NostrEvent,
): Promise<string | undefined> {
  try {
    await storeTimelineEvent(event);
    return undefined;
  } catch (error) {
    return `Local archive failed: ${publishErrorMessage(error, 'storage unavailable')}`;
  }
}

export function publishErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
