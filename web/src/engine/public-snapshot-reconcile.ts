// Positive engine evidence invalidates saved public references, never absence or EOSE.

import { invalidatePeople } from '../shared/people.ts';
import type {
  Author,
  FromEngine,
  NoteRow,
  PatchOp,
  PublicCacheHoldRow,
  PublicCacheReconcile,
  Row,
} from './protocol.ts';
import { mergePublicRow } from './public-snapshot-model.ts';
import {
  type PublicSnapshot,
  rewritePublicSnapshots,
  withoutPublicRows,
} from './public-snapshot-store.ts';
import type { PublicView } from './public-snapshot-view.ts';

export type PublicInvalidations = {
  readonly keys: Set<string>;
  readonly profiles: Set<string>;
  readonly quotes: Set<string>;
};
const validId = (id: string | undefined): id is string => !!id && /^[0-9a-f]{64}$/.test(id);

/** References only; cached authors, bodies and counts are never admitted to the event store. */
export function heldPublicReferences(rows: readonly Row[]): PublicCacheHoldRow[] {
  return rows.slice(0, 64).map((row) => {
    const profiles = new Map<string, { pubkey: string; id: string }>();
    const quotes = new Set<string>();
    const person = (a: Author | undefined): void => {
      if (a && validId(a.profileId) && validId(a.pubkey) && profiles.size < 16)
        profiles.set(a.profileId, { pubkey: a.pubkey, id: a.profileId });
    };
    const reference = (id: string | undefined): void => {
      if (validId(id) && quotes.size < 8) quotes.add(id);
    };
    const note = (value: NoteRow): void => {
      person(value.author);
      person(value.replyTo?.author);
      reference(value.replyTo?.id);
      for (const actor of value.repostedBy?.actors ?? []) person(actor);
      for (const quote of value.quotes) {
        reference(quote.id);
        if (quote.state === 'ok') person(quote.author);
      }
    };
    if (row.kind === 'note') note(row);
    else if (row.kind === 'notification') {
      for (const actor of row.actors) person(actor);
      reference(row.target?.id);
      if (row.note) {
        reference(row.note.id);
        note(row.note);
      }
    } else if (row.kind === 'channel') {
      person(row.creator);
      person(row.last?.author);
    } else if ('author' in row) person(row.author);
    if (row.kind === 'profile') for (const actor of row.knownFollowers?.actors ?? []) person(actor);
    return {
      key: row.key,
      ...(row.kind === 'note' && validId(row.id) ? { id: row.id } : {}),
      profiles: [...profiles.values()],
      quotes: [...quotes].map((id) => ({ id })),
    };
  });
}

function author(value: Author, bad: PublicInvalidations): Author {
  if (!value.profileId || !bad.profiles.has(value.profileId)) return value;
  return {
    pubkey: value.pubkey,
    npub: value.npub,
    name: '',
    ...(value.muted ? { muted: true } : {}),
  };
}
function note(value: NoteRow, bad: PublicInvalidations): NoteRow {
  return {
    ...value,
    author: author(value.author, bad),
    replyTo:
      value.replyTo && !bad.quotes.has(value.replyTo.id)
        ? { ...value.replyTo, author: author(value.replyTo.author, bad) }
        : undefined,
    repostedBy: value.repostedBy
      ? { ...value.repostedBy, actors: value.repostedBy.actors.map((a) => author(a, bad)) }
      : undefined,
    quotes: value.quotes.map((q) =>
      bad.quotes.has(q.id)
        ? { state: 'deleted' as const, id: q.id }
        : q.state === 'ok'
          ? { ...q, author: author(q.author, bad) }
          : q,
    ),
  };
}
export function invalidatePublicRow(row: Row, bad: PublicInvalidations | undefined): Row {
  if (!bad || (!bad.profiles.size && !bad.quotes.size)) return row;
  let next: Row = row;
  if (row.kind === 'note') next = note(row, bad);
  else if (row.kind === 'notification')
    next = {
      ...row,
      actors: row.actors.map((a) => author(a, bad)),
      note: row.note && !bad.quotes.has(row.note.id) ? note(row.note, bad) : undefined,
      target:
        row.target && bad.quotes.has(row.target.id)
          ? { ...row.target, excerpt: '', media: 0 }
          : row.target,
    };
  else if (row.kind === 'profile')
    next = {
      ...row,
      author: author(row.author, bad),
      knownFollowers: row.knownFollowers
        ? { ...row.knownFollowers, actors: row.knownFollowers.actors.map((a) => author(a, bad)) }
        : undefined,
      ...(row.author.profileId && bad.profiles.has(row.author.profileId)
        ? {
            banner: undefined,
            about: [],
            website: undefined,
            lud16: undefined,
            updatedAt: undefined,
          }
        : {}),
    };
  else if (row.kind === 'person')
    next = {
      ...row,
      author: author(row.author, bad),
      about: row.author.profileId && bad.profiles.has(row.author.profileId) ? '' : row.about,
    };
  else if (row.kind === 'channel')
    next = {
      ...row,
      creator: row.creator ? author(row.creator, bad) : undefined,
      last: row.last ? { ...row.last, author: author(row.last.author, bad) } : undefined,
    };
  else if (row.kind === 'mute' && row.author) next = { ...row, author: author(row.author, bad) };
  return JSON.stringify(next) === JSON.stringify(row) ? row : next;
}

export function reconcilePublicView(
  view: PublicView,
  message: PublicCacheReconcile,
  receive: (message: FromEngine) => void,
): void {
  const bad = (view.invalidations ??= { keys: new Set(), profiles: new Set(), quotes: new Set() });
  // Bound by the 64 originally held rows and their 16/8 references; unknown extras are ignored.
  const held = view.references ?? heldPublicReferences(view.held?.rows ?? view.rows);
  const keys = new Set(held.map((r) => r.key));
  const profiles = new Set(held.flatMap((r) => (r.profiles ?? []).map((p) => p.id)));
  const quotes = new Set(held.flatMap((r) => (r.quotes ?? []).map((q) => q.id)));
  for (const key of message.removedKeys) if (keys.has(key)) bad.keys.add(key);
  for (const id of message.invalidProfileIds) if (profiles.has(id)) bad.profiles.add(id);
  for (const id of message.removedQuoteIds) if (quotes.has(id)) bad.quotes.add(id);
  invalidatePeople(bad.profiles);
  const before = view.held?.rows ?? view.rows;
  const rewrite = (snapshot: PublicSnapshot): PublicSnapshot | undefined => {
    const kept = withoutPublicRows(snapshot, bad.keys);
    return kept
      ? { ...kept, rows: kept.rows.map((row) => invalidatePublicRow(row, bad)) }
      : undefined;
  };
  rewritePublicSnapshots(view.identity, rewrite);
  view.rows = view.rows.filter((r) => !bad.keys.has(r.key)).map((r) => invalidatePublicRow(r, bad));
  if (view.held) view.held = rewrite(view.held);
  const after = new Map((view.held?.rows ?? view.rows).map((row) => [row.key, row]));
  const ops = before.flatMap<PatchOp>((old) => {
    if (bad.keys.has(old.key)) return [{ op: 'remove' as const, key: old.key }];
    const row = after.get(old.key);
    return row && row !== old ? [{ op: 'update' as const, row }] : [];
  });
  if (ops.length) receive({ t: 'patch', sub: message.sub, ops });
  for (const key of bad.keys) view.counts.delete(key);
  view.dirty = true;
}

export function mergePublicRows(view: PublicView, rows: readonly Row[]): Row[] {
  const previous = new Map(view.rows.map((row) => [row.key, row]));
  return rows
    .slice(0, 6400)
    .filter((row) => !view.invalidations?.keys.has(row.key))
    .map((row) => {
      const old = previous.get(row.key);
      return invalidatePublicRow(old ? mergePublicRow(old, row) : row, view.invalidations);
    });
}

export function publicPatchOps(view: PublicView, ops: readonly PatchOp[]): PatchOp[] {
  return ops.map((op) => {
    if (op.op === 'insert')
      return {
        ...op,
        rows: op.rows
          .filter((row) => !view.invalidations?.keys.has(row.key))
          .map((row) => invalidatePublicRow(row, view.invalidations)),
      };
    if (op.op !== 'update') return op;
    if (view.invalidations?.keys.has(op.row.key)) return { op: 'remove', key: op.row.key };
    const old = view.rows.find((row) => row.key === op.row.key);
    return {
      ...op,
      row: invalidatePublicRow(old ? mergePublicRow(old, op.row) : op.row, view.invalidations),
    };
  });
}
