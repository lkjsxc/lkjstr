// Display-only projections for the private mock. Production parsing remains in Rust.
import type { DmMessage, DmQuery, DmSnapshot } from '../protocol.ts';
import { stranger } from './accounts.ts';
import { byPubkey } from './people.ts';

export function privateSnapshot(o: {
  query: DmQuery;
  rows: readonly DmMessage[];
  inboxes: ReadonlyMap<string, readonly string[]>;
  seen: ReadonlySet<string>;
  error?: string;
}): DmSnapshot {
  const { query, error } = o;
  const rows =
    error && error !== 'not-found'
      ? []
      : o.rows
          .filter((m) => m.participants.includes(query.account))
          .map((m) => ({
            ...m,
            unread: m.author !== query.account && !o.seen.has(`${query.account}:${m.id}`),
          }))
          .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
  const rooms = new Map<string, DmSnapshot['conversations'][number]>();
  for (const message of rows) {
    const had = rooms.get(message.conversation);
    const recent = [
      ...new Set([
        ...(had?.recentAuthors ?? []),
        ...(message.author === query.account ? [] : [message.author]),
      ]),
    ].slice(0, 2);
    rooms.set(message.conversation, {
      key: message.conversation,
      participants: message.participants,
      last: had?.last ?? message,
      unread: (had?.unread ?? 0) + Number(message.unread),
      recentAuthors: recent,
    });
  }
  const selected = rows.filter((m) => m.conversation === query.conversation);
  const start = query.before
    ? Math.max(0, selected.findIndex((m) => m.id === query.before) + 1)
    : 0;
  const limit = Math.max(1, Math.min(200, query.limit ?? 100));
  const participants = query.participants ?? selected[0]?.participants ?? [];
  const people = [
    ...new Set([
      query.account,
      ...participants,
      ...[...rooms.values()].slice(0, 200).flatMap((c) => c.participants),
    ]),
  ].slice(0, 2048);
  const messages = selected.slice(start, start + limit).map((message) => {
    const reply = rows.find((m) => m.id === message.replyTo);
    return {
      ...message,
      segments: message.segments ?? [{ k: 'text' as const, text: message.text }],
      ...(reply
        ? {
            reply: { id: reply.id, author: reply.author, excerpt: reply.text.split('\n')[0] ?? '' },
          }
        : {}),
    };
  });
  return {
    account: query.account,
    ...(query.conversation ? { conversation: query.conversation } : {}),
    conversations: query.unreadOnly || query.conversation ? [] : [...rooms.values()].slice(0, 200),
    messages: query.unreadOnly ? [] : messages,
    unread: rows.filter((m) => m.unread).length,
    ...(!query.unreadOnly
      ? {
          people: people.map((key) => byPubkey(key)?.author ?? stranger(key)),
          blocked: participants.filter((key) => !o.inboxes.get(key)?.length),
        }
      : {}),
    more: query.unreadOnly
      ? false
      : query.conversation
        ? selected.length > start + limit
        : rooms.size > 200,
    undecryptable: 0,
    phase: error === 'not-found' ? 'unsupported' : error ? 'failed' : 'live',
    ...(error ? { error } : {}),
  };
}
