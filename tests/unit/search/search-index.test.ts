import { describe, expect, it } from 'vitest';
import {
  eventSearchTokenRows,
  tokenizeSearchQuery,
} from '../../../src/lib/search/search-tokenizer';
import {
  clearMemorySearchIndex,
  memorySearchEvents,
  putMemorySearchEvent,
} from '../../../src/lib/search/search-index-memory';
import type { StoredEvent } from '../../../src/lib/events/types';

describe('search index', () => {
  it('normalizes query tokens deterministically', () => {
    expect(tokenizeSearchQuery('  Nostr-WASM nostr_wasm  ')).toEqual([
      'nostr-wasm',
      'nostr_wasm',
    ]);
  });

  it('builds portable event token rows with positions', () => {
    expect(eventSearchTokenRows(event('1', 'hello hello world'))).toMatchObject(
      [
        { token: 'hello', position: 0 },
        { token: 'hello', position: 1 },
        { token: 'world', position: 2 },
      ],
    );
  });

  it('intersects tokens without scanning all rows', () => {
    clearMemorySearchIndex();
    putMemorySearchEvent(event('1', 'nostr relay search'));
    putMemorySearchEvent(event('2', 'nostr only'));

    expect(
      memorySearchEvents({ query: 'nostr search', limit: 10 }).map(
        (item) => item.id,
      ),
    ).toEqual(['1'.repeat(64)]);
  });
});

function event(id: string, content: string): StoredEvent {
  return {
    id: id.repeat(64).slice(0, 64),
    pubkey: '2'.repeat(64),
    sig: '3'.repeat(128),
    kind: 1,
    tags: [],
    created_at: Number(id) || 1,
    content,
    receivedAt: 1,
    relayUrls: [],
  };
}
