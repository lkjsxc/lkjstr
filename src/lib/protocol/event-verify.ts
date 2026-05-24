import { verifySchnorrHex } from './crypto';
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
  const valid = verifySchnorrHex(event.sig, event.id, event.pubkey);
  if (!valid)
    return {
      ok: false,
      code: 'bad_signature',
      message: 'event signature is invalid',
    };
  return { ok: true, event };
}
