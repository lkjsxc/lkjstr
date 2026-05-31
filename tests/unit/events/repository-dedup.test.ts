import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredEvent } from '../../../src/lib/events/types';
import type { NostrEvent } from '../../../src/lib/protocol';

const state = vi.hoisted(() => ({
  storedEvent: undefined as StoredEvent | undefined,
  eventWrites: 0,
  routeWrites: 0,
  suggestionWrites: 0,
}));

vi.mock('../../../src/lib/storage/safe-storage', () => ({
  boundedStorageRead: async <T>(read: () => Promise<T>) => read(),
  indexedDbAvailable: () => true,
}));

vi.mock('../../../src/lib/storage/repositories/events-store', () => ({
  readStoredEventRow: async (_id: string, fallback: StoredEvent | undefined) =>
    state.storedEvent ?? fallback,
  readStoredEventRows: async () => [],
  putFeedCursorWithLedger: async () => undefined,
  putStoredEventWithLedger: async (input: { stored: StoredEvent }) => {
    state.eventWrites += 1;
    state.storedEvent = input.stored;
  },
}));

vi.mock('../../../src/lib/relays/relay-list-suggestions', () => ({
  storeRelayListSuggestionsFromEvent: async () => {
    state.suggestionWrites += 1;
    return [];
  },
}));

vi.mock('../../../src/lib/relays/relay-route-events', () => ({
  storeRoutesFromEvent: async () => {
    state.routeWrites += 1;
  },
}));

describe('event repository durable deduplication', () => {
  beforeEach(() => {
    state.storedEvent = undefined;
    state.eventWrites = 0;
    state.routeWrites = 0;
    state.suggestionWrites = 0;
  });

  it('skips durable rewrites for duplicate relay evidence', async () => {
    const { clearEventRepositoryForTests, upsertEvent } = await import(
      '../../../src/lib/events/repository'
    );
    const duplicate = event('d', 12, 'duplicate');

    clearEventRepositoryForTests();
    await upsertEvent(duplicate, ['wss://relay-a'], 1_000);
    await upsertEvent(duplicate, ['wss://relay-a'], 2_000);

    expect(state.eventWrites).toBe(1);
    expect(state.routeWrites).toBe(1);
    expect(state.suggestionWrites).toBe(1);
    expect(state.storedEvent?.receivedAt).toBe(1_000);

    await upsertEvent(duplicate, ['wss://relay-b'], 3_000);
    expect(state.eventWrites).toBe(2);
    expect(state.storedEvent?.relayUrls).toEqual([
      'wss://relay-a',
      'wss://relay-b',
    ]);
  });
});

function event(
  idSeed: string,
  created_at: number,
  content: string,
): NostrEvent {
  return {
    id: idSeed.repeat(64).slice(0, 64),
    pubkey: idSeed.repeat(64).slice(0, 64),
    created_at,
    kind: 1,
    tags: [],
    content,
    sig: idSeed.repeat(128).slice(0, 128),
  };
}
