import { describe, expect, it } from 'vitest';
import { fullNpub } from '../../../src/lib/identity/npub';
import { encodeNpub } from '../../../src/lib/protocol/nip19';

describe('fullNpub', () => {
  it('renders a full npub for a hex public key', () => {
    const pubkey =
      'f'.repeat(64);
    expect(fullNpub(pubkey)).toBe(encodeNpub(pubkey));
  });

  it('falls back to the input when encoding fails', () => {
    expect(fullNpub('not-a-pubkey')).toBe('not-a-pubkey');
  });
});
