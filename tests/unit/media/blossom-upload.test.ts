import { describe, expect, it, vi } from 'vitest';
import { resolveBlossomUploadEndpoint } from '../../../src/lib/media/endpoint';

vi.mock('../../../src/lib/accounts/signer', () => ({
  resolveActiveSigner: vi.fn(async () => ({
    account: { pubkey: 'a'.repeat(64) },
    signEvent: async (event: Record<string, unknown>) => ({
      ...event,
      id: 'b'.repeat(64),
      sig: 'c'.repeat(128),
    }),
  })),
}));

describe('Blossom endpoint resolution', () => {
  it('uses origin /upload for server origins', () => {
    expect(resolveBlossomUploadEndpoint('https://media.example')).toBe(
      'https://media.example/upload',
    );
  });

  it('accepts explicit HTTPS upload endpoints', () => {
    expect(resolveBlossomUploadEndpoint('https://media.example/custom')).toBe(
      'https://media.example/custom',
    );
    expect(() => resolveBlossomUploadEndpoint('http://media.example')).toThrow(
      /HTTPS/,
    );
  });
});

describe('Blossom media upload transport', () => {
  it('puts raw blobs and validates descriptor hashes', async () => {
    const { uploadMediaFile } = await import('../../../src/lib/media/upload');
    let authTags: unknown;
    const uploaded = await uploadMediaFile(
      new File(['abc'], 'pixel.png', { type: 'image/png' }),
      {
        provider: 'blossom',
        customServer: 'https://media.example',
        server: 'https://media.example',
        protocol: 'blossom',
        noTransform: true,
      },
      {
        fetcher: async (input, init) => {
          expect(String(input)).toBe('https://media.example/upload');
          expect(init?.method).toBe('PUT');
          expect(init?.body).toBeInstanceOf(File);
          authTags = authEvent(init?.headers).tags;
          return Response.json({
            url: 'https://media.example/abc.png',
            sha256:
              'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
            size: 3,
            type: 'image/png',
          });
        },
      },
    );
    expect(uploaded.url).toBe('https://media.example/abc.png');
    expect(uploaded.imeta).toContain(
      'x ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(authTags).toEqual(
      expect.arrayContaining([
        ['t', 'upload'],
        ['method', 'PUT'],
        ['size', '3'],
      ]),
    );
  });
});

function authEvent(headers: HeadersInit | undefined) {
  const value =
    headers instanceof Headers
      ? headers.get('Authorization')
      : (headers as Record<string, string>).Authorization;
  return JSON.parse(Buffer.from(String(value).slice(6), 'base64').toString());
}
