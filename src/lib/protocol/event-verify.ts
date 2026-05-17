import { verifyEvent as verifyNostrEvent } from 'nostr-tools/pure';
import { computeEventId } from './event-id';
import type { NostrEvent } from './event';

export type VerificationResult =
  | { ok: true; event: NostrEvent }
  | { ok: false; code: 'id_mismatch' | 'bad_signature'; message: string };

export function verifyEvent(event: NostrEvent): VerificationResult {
  const id = computeEventId(event);
  if (id !== event.id)
    return {
      ok: false,
      code: 'id_mismatch',
      message: 'event id does not match payload',
    };
  const valid = verifyNostrEvent({
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
    sig: event.sig,
  });
  if (!valid)
    return {
      ok: false,
      code: 'bad_signature',
      message: 'event signature is invalid',
    };
  return { ok: true, event };
}
