import type { NostrEvent } from '$lib/protocol';
import { eventSearchTokenRows } from '$lib/search/search-tokenizer';
import type { SqlStep } from './types';

export function eventSearchIndexSteps(event: NostrEvent): SqlStep[] {
  return [
    {
      statement: 'DELETE FROM event_search_tokens WHERE event_id = ?1;',
      params: [event.id],
    },
    ...eventSearchTokenRows(event).map((row, index) => ({
      statement:
        'INSERT INTO event_search_tokens (id, event_id, token, token_pos, created_at, kind, pubkey) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);',
      params: [
        `${event.id}:${index}`,
        row.eventId,
        row.token,
        row.position,
        row.createdAt,
        row.kind,
        row.pubkey,
      ],
    })),
  ];
}
