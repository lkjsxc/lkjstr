import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  computeEventId,
  finalizeEvent,
  getPublicKey,
  parseSecretKeyHex,
  signSchnorrHex,
  verifySchnorrHex,
} from '../../../src/lib/protocol';
import { secretKeyHex } from '../../helpers/nostr-fixtures';

describe('protocol crypto', () => {
  it('derives keys and parses valid secret hex', () => {
    const secret = parseSecretKeyHex(secretKeyHex);
    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret ? bytesToHex(secret) : '').toBe(secretKeyHex);
    expect(getPublicKey(secretKeyHex)).toHaveLength(64);
    expect(parseSecretKeyHex('ff')).toBeUndefined();
  });

  it('signs and verifies Schnorr messages as hex', () => {
    const event = finalizeEvent(
      {
        created_at: 1,
        kind: 1,
        tags: [],
        content: 'sign',
      },
      secretKeyHex,
    );
    const id = computeEventId(event);
    const sig = signSchnorrHex(id, secretKeyHex);
    expect(verifySchnorrHex(sig, id, event.pubkey)).toBe(true);
    expect(verifySchnorrHex(sig, '00'.repeat(32), event.pubkey)).toBe(false);
  });
});
