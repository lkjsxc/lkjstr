import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importSettingsJson } from '../../../src/lib/settings/settings-store';
import {
  cleanUploadProvider,
  providerProtocol,
  validCustomUploadServer,
} from '../../../src/lib/media/providers';
import { loadUploadSettings } from '../../../src/lib/media/settings';
import { resolveUploadEndpoint } from '../../../src/lib/media/endpoint';

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

describe('media upload settings', () => {
  beforeEach(async () => {
    await importSettingsJson('[]');
  });

  it('defaults and falls back to Blossom while respecting disabled', async () => {
    const defaults = await loadUploadSettings();
    expect(defaults.provider).toBe('blossom');
    expect(defaults.protocol).toBe('blossom');
    expect(cleanUploadProvider('unknown-provider')).toBe('blossom');
    await importSettingsJson(
      JSON.stringify([{ key: 'tweet.mediaUploadProvider', value: 'disabled' }]),
    );
    expect((await loadUploadSettings()).server).toBe('');
  });

  it('validates custom HTTPS servers', () => {
    expect(validCustomUploadServer('')).toBe(true);
    expect(validCustomUploadServer('https://media.example')).toBe(true);
    expect(validCustomUploadServer('http://media.example')).toBe(false);
  });

  it('classifies Blossom and NIP-96 provider protocols', () => {
    expect(providerProtocol('blossom')).toBe('blossom');
    expect(providerProtocol('custom')).toBe('nip96');
    expect(providerProtocol('nostr-build')).toBe('nip96');
  });
});

describe('NIP-96 endpoint resolution', () => {
  it('uses discovered api_url', async () => {
    const endpoint = await resolveUploadEndpoint(
      'https://media.example',
      fetcher({
        'https://media.example/.well-known/nostr/nip96.json': {
          api_url: 'https://media.example/upload',
        },
      }),
    );
    expect(endpoint).toBe('https://media.example/upload');
  });

  it('prefers valid api_url over delegated_to_url', async () => {
    const endpoint = await resolveUploadEndpoint(
      'https://media.example',
      fetcher({
        'https://media.example/.well-known/nostr/nip96.json': {
          api_url: 'https://media.example/upload',
          delegated_to_url: 'https://delegate.example',
        },
        'https://delegate.example/.well-known/nostr/nip96.json': {
          api_url: 'https://delegate.example/upload',
        },
      }),
    );
    expect(endpoint).toBe('https://media.example/upload');
  });

  it('follows delegated discovery with a loop guard', async () => {
    const endpoint = await resolveUploadEndpoint(
      'https://media.example',
      fetcher({
        'https://media.example/.well-known/nostr/nip96.json': {
          delegated_to_url: 'https://delegate.example',
        },
        'https://delegate.example/.well-known/nostr/nip96.json': {
          api_url: 'https://delegate.example/upload',
        },
      }),
    );
    expect(endpoint).toBe('https://delegate.example/upload');
  });

  it('falls back to the configured HTTPS endpoint', async () => {
    const endpoint = await resolveUploadEndpoint(
      'https://media.example/upload',
      async () => new Response('', { status: 404 }),
    );
    expect(endpoint).toBe('https://media.example/upload');
    await expect(resolveUploadEndpoint('http://media.example')).rejects.toThrow(
      /HTTPS/,
    );
  });
});

describe('media upload validation', () => {
  it('rejects empty, oversized, and unsupported media files', async () => {
    const { maxMediaUploadBytes, validateMediaFile } =
      await import('../../../src/lib/media/upload');
    expect(validateMediaFile({ size: 0, type: 'image/png' })).toMatch(/empty/);
    expect(
      validateMediaFile({ size: maxMediaUploadBytes + 1, type: 'image/png' }),
    ).toMatch(/larger/);
    expect(validateMediaFile({ size: 1, type: 'text/plain' })).toMatch(
      /image, video, or audio/,
    );
    expect(validateMediaFile({ size: 1, type: 'video/mp4' })).toBeUndefined();
  });
});

describe('media upload transport', () => {
  it('posts file, no_transform, and payload hash auth', async () => {
    const { uploadMediaFile } = await import('../../../src/lib/media/upload');
    let authTags: unknown;
    const uploaded = await uploadMediaFile(
      new File(['abc'], 'pixel.png', { type: 'image/png' }),
      {
        provider: 'custom',
        customServer: 'https://media.example',
        server: 'https://media.example',
        protocol: 'nip96',
        noTransform: true,
      },
      {
        includePayloadHash: true,
        fetcher: async (input, init) => {
          const url = String(input);
          if (url.endsWith('/.well-known/nostr/nip96.json'))
            return Response.json({ api_url: 'https://media.example/upload' });
          const body = init?.body as FormData;
          expect(body.get('no_transform')).toBe('true');
          expect((body.get('file') as File).name).toBe('pixel.png');
          authTags = authEvent(init?.headers).tags;
          return Response.json({
            tags: [['url', 'https://cdn.example/pixel.png']],
          });
        },
      },
    );
    expect(uploaded.url).toBe('https://cdn.example/pixel.png');
    expect(authTags).toEqual(
      expect.arrayContaining([
        ['method', 'POST'],
        ['payload', expect.any(String)],
      ]),
    );
  });
});

function fetcher(documents: Record<string, unknown>) {
  return async (input: RequestInfo | URL) => {
    const value = documents[String(input)];
    return value ? Response.json(value) : new Response('', { status: 404 });
  };
}

function authEvent(headers: HeadersInit | undefined) {
  const value =
    headers instanceof Headers
      ? headers.get('Authorization')
      : (headers as Record<string, string>).Authorization;
  return JSON.parse(Buffer.from(String(value).slice(6), 'base64').toString());
}
