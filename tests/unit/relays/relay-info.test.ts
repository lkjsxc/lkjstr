import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRelayInformation,
  parseRelayInformation,
  relayHttpUrl,
} from '../../../src/lib/relays/relay-info';

describe('relay information documents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('converts websocket relay URLs to HTTP metadata endpoints', () => {
    expect(relayHttpUrl('wss://relay.example/path?a=1')).toBe(
      'https://relay.example/path?a=1',
    );
    expect(relayHttpUrl('ws://relay.example/')).toBe('http://relay.example/');
  });

  it('fetches NIP-11 JSON with the relay information accept header', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            name: 'Relay',
            supported_nips: [1, 11, 50],
            limitation: { max_limit: 100 },
          }),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const record = await fetchRelayInformation('wss://relay.example');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example/',
      expect.objectContaining({
        headers: { Accept: 'application/nostr+json' },
      }),
    );
    expect(record).toMatchObject({
      relayUrl: 'wss://relay.example/',
      status: 'available',
      info: { name: 'Relay', supported_nips: [1, 11, 50] },
    });
  });

  it('stores malformed or failed metadata as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve('bad'),
        }),
      ),
    );

    await expect(fetchRelayInformation('relay.example')).resolves.toMatchObject(
      {
        status: 'unavailable',
        error: 'Relay information is not a JSON object.',
      },
    );
  });

  it('keeps only understood fields from metadata documents', () => {
    const parsed = parseRelayInformation({
      name: 'Relay',
      supported_nips: [1, 'bad', 50],
      software: 'https://relay.example/software',
      ignored: true,
    });
    expect(parsed).toMatchObject({
      name: 'Relay',
      supported_nips: [1, 50],
      software: 'https://relay.example/software',
    });
    expect(parsed).not.toHaveProperty('ignored');
  });
});
