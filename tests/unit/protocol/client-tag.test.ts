import { describe, expect, it } from 'vitest';
import {
  appendClientTag,
  clientTagAllowedForKind,
  clientTagParts,
  kinds,
} from '../../../src/lib/protocol';

const config = {
  enabled: true,
  name: ' lkjstr ',
  address: `31990:${'A'.repeat(64)}:lkjstr`,
  relay: 'relay.example',
};

describe('NIP-89 client tags', () => {
  it('normalizes valid tag parts', () => {
    expect(clientTagParts(config, kinds.textNote)).toEqual([
      'client',
      'lkjstr',
      `31990:${'a'.repeat(64)}:lkjstr`,
      'wss://relay.example/',
    ]);
  });

  it('replaces existing client tags before signing', () => {
    expect(
      appendClientTag([['client', 'old']], config, kinds.textNote),
    ).toHaveLength(1);
  });

  it('does not tag auth or disabled events', () => {
    expect(clientTagAllowedForKind(kinds.httpAuth)).toBe(false);
    expect(
      appendClientTag([['client', 'old']], config, kinds.httpAuth),
    ).toEqual([]);
    expect(
      clientTagParts({ ...config, enabled: false }, kinds.textNote),
    ).toBeUndefined();
  });
});
