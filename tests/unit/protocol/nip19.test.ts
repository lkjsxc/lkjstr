import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  decodeEntity,
  encodeNaddr,
  encodeNevent,
  encodeNote,
  encodeNprofile,
  encodeNpub,
  encodeNsec,
  generateSecretKey,
  getPublicKey,
} from '../../../src/lib/protocol';

describe('protocol NIP-19', () => {
  it('roundtrips scalar entities', () => {
    const secret = generateSecretKey();
    const pubkey = getPublicKey(secret);
    const id = 'ab'.repeat(32);
    expect(decodeEntity(encodeNpub(pubkey))).toEqual({
      type: 'npub',
      data: pubkey,
    });
    expect(decodeEntity(encodeNote(id))).toEqual({ type: 'note', data: id });
    expect(decodeEntity(encodeNsec(secret))).toEqual({
      type: 'nsec',
      data: secret,
    });
    expect(decodeEntity(encodeNsec(bytesToHex(secret)))).toMatchObject({
      type: 'nsec',
    });
  });

  it('roundtrips TLV entities', () => {
    const pubkey = '11'.repeat(32);
    const id = '22'.repeat(32);
    expect(
      decodeEntity(encodeNprofile({ pubkey, relays: ['wss://relay.example'] })),
    ).toEqual({
      type: 'nprofile',
      data: { pubkey, relays: ['wss://relay.example'] },
    });
    expect(
      decodeEntity(
        encodeNevent({ id, relays: ['wss://r'], author: pubkey, kind: 1 }),
      ),
    ).toEqual({
      type: 'nevent',
      data: { id, relays: ['wss://r'], author: pubkey, kind: 1 },
    });
    expect(
      decodeEntity(
        encodeNaddr({ identifier: 'name', pubkey, kind: 30023, relays: [] }),
      ),
    ).toEqual({
      type: 'naddr',
      data: { identifier: 'name', pubkey, kind: 30023, relays: undefined },
    });
  });

  it('rejects malformed and oversized values', () => {
    expect(decodeEntity('not-an-entity')).toBeUndefined();
    expect(decodeEntity(`npub1${'q'.repeat(5000)}`)).toBeUndefined();
  });
});
