import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearRelayInformationMemoryForTests,
  fetchRelayInformation,
  parseRelayInformation,
  relayInformationMemorySizeForTests,
  relayHttpUrl,
  relayRequestLimit,
  saveRelayInformation,
} from '../../../src/lib/relays/relay-info';

describe('relay information documents', () => {
  afterEach(() => {
    clearRelayInformationMemoryForTests();
    vi.unstubAllGlobals();
  });

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

  it('parses useful NIP-11 fields and typed limitations', () => {
    const hex = 'a'.repeat(64);
    const parsed = parseRelayInformation({
      name: 'Relay',
      description: 'A relay',
      banner: 'https://relay.example/banner.png',
      icon: 'https://relay.example/icon.png',
      pubkey: hex,
      self: hex,
      contact: 'mailto:relay@example.com',
      supported_nips: [1, 11, 50],
      software: 'https://relay.example/software',
      version: 'relay-build',
      terms_of_service: 'https://relay.example/terms',
      payments_url: 'https://relay.example/pay',
      fees: { admission: [] },
      limitation: {
        max_message_length: 1000,
        max_subscriptions: 4,
        max_limit: 200,
        max_subid_length: 12,
        max_event_tags: 128,
        max_content_length: 4096,
        min_pow_difficulty: 8,
        auth_required: true,
        payment_required: false,
        restricted_writes: true,
        created_at_lower_limit: 100,
        created_at_upper_limit: 200,
        default_limit: 50,
      },
    });

    expect(parsed).toMatchObject({
      pubkey: hex,
      self: hex,
      terms_of_service: 'https://relay.example/terms',
      payments_url: 'https://relay.example/pay',
      limitation: {
        maxMessageLength: 1000,
        maxSubscriptions: 4,
        maxLimit: 200,
        maxSubIdLength: 12,
        maxEventTags: 128,
        maxContentLength: 4096,
        minPowDifficulty: 8,
        authRequired: true,
        paymentRequired: false,
        restrictedWrites: true,
        createdAtLowerLimit: 100,
        createdAtUpperLimit: 200,
        defaultLimit: 50,
      },
    });
  });

  it('ignores invalid optional and limitation fields', () => {
    const parsed = parseRelayInformation({
      pubkey: 'A'.repeat(64),
      self: 'not-hex',
      limitation: {
        max_limit: 0,
        max_message_length: -1,
        auth_required: 'false',
        payment_required: 1,
      },
    });

    expect(parsed).not.toHaveProperty('pubkey');
    expect(parsed).not.toHaveProperty('self');
    expect(parsed.limitation).toEqual({});
  });

  it('accepts subscription id length aliases', () => {
    expect(
      parseRelayInformation({
        limitation: { max_subscription_id_length: 9 },
      }).limitation?.maxSubIdLength,
    ).toBe(9);
    expect(
      parseRelayInformation({
        limitation: { max_subid_length: 7 },
      }).limitation?.maxSubIdLength,
    ).toBe(7);
  });

  it('caps request limits with NIP-11 max_limit when present', () => {
    expect(relayRequestLimit(100, { limitation: { maxLimit: 20 } })).toBe(20);
    expect(relayRequestLimit(30, { limitation: {} })).toBe(30);
    expect(relayRequestLimit(0, { limitation: { maxLimit: 20 } })).toBe(1);
  });

  it('bounds relay information memory records', async () => {
    for (let index = 0; index < 129; index += 1) {
      await saveRelayInformation({
        relayUrl: `wss://relay-${index}.example/`,
        fetchedAt: index,
        status: 'available',
      });
    }

    expect(relayInformationMemorySizeForTests()).toBe(128);
  });
});
