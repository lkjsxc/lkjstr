import { describe, expect, it } from 'vitest';
import { encodeNpub } from '../../../src/lib/protocol';
import {
  estimatedAttempts,
  npubMatchesPrefix,
  parseNpubPrefix,
} from '../../../src/lib/accounts/npub-miner';

describe('npub miner helpers', () => {
  it('normalizes prefix input after npub1', () => {
    expect(parseNpubPrefix(' NPub1acd ')).toEqual({
      ok: true,
      prefix: 'acd',
    });
  });

  it('rejects empty, long, and invalid prefixes', () => {
    expect(parseNpubPrefix('')).toMatchObject({ ok: false });
    expect(parseNpubPrefix('a'.repeat(9))).toMatchObject({ ok: false });
    expect(parseNpubPrefix('bio')).toMatchObject({ ok: false });
  });

  it('matches encoded npub prefixes only after npub1', () => {
    const npub = encodeNpub('a'.repeat(64));
    expect(npubMatchesPrefix(npub, npub.slice(5, 7))).toBe(true);
    expect(npubMatchesPrefix(npub, 'zz')).toBe(false);
  });

  it('estimates cpu search size from bech32 alphabet length', () => {
    expect(estimatedAttempts('ab')).toBe(1024);
  });
});
