import { describe, expect, it } from 'vitest';
import {
  blossomUploadAuthEvent,
  blossomUploadEndpoint,
  parseBlossomBlobDescriptor,
} from '../../../src/lib/protocol/blossom';

describe('Blossom protocol helpers', () => {
  it('resolves upload endpoints from HTTPS servers', () => {
    expect(blossomUploadEndpoint('https://media.example')).toBe(
      'https://media.example/upload',
    );
    expect(blossomUploadEndpoint('https://media.example/blob')).toBe(
      'https://media.example/blob',
    );
    expect(blossomUploadEndpoint('http://media.example')).toBeUndefined();
  });

  it('builds scoped upload auth events', () => {
    const event = blossomUploadAuthEvent({
      pubkey: 'a'.repeat(64),
      endpoint: 'https://media.example/upload',
      sha256: 'b'.repeat(64),
      size: 12,
      now: 100,
      expiresInSeconds: 30,
    });
    expect(event).toMatchObject({ kind: 24242, created_at: 100 });
    expect(event.tags).toEqual(
      expect.arrayContaining([
        ['t', 'upload'],
        ['x', 'b'.repeat(64)],
        ['u', 'https://media.example/upload'],
        ['method', 'PUT'],
        ['size', '12'],
        ['expiration', '130'],
      ]),
    );
  });

  it('parses matching blob descriptors into media tags', () => {
    const hash = 'c'.repeat(64);
    const parsed = parseBlossomBlobDescriptor({
      value: {
        url: 'https://media.example/blob.png',
        sha256: hash,
        size: 9,
        type: 'image/png',
      },
      expectedHash: hash,
      fallbackUrl: 'https://media.example/c',
    });
    expect(parsed?.tags).toEqual([
      ['url', 'https://media.example/blob.png'],
      ['x', hash],
      ['m', 'image/png'],
      ['size', '9'],
    ]);
    expect(parsed?.imeta).toEqual([
      'imeta',
      'url https://media.example/blob.png',
      `m image/png`,
      `x ${hash}`,
      'size 9',
    ]);
  });

  it('rejects mismatched descriptor hashes', () => {
    expect(
      parseBlossomBlobDescriptor({
        value: {
          url: 'https://media.example/blob.png',
          sha256: 'd'.repeat(64),
        },
        expectedHash: 'e'.repeat(64),
        fallbackUrl: 'https://media.example/e',
      }),
    ).toBeUndefined();
  });
});
