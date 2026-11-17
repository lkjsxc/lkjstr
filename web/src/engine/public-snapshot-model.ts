// Reconciliation preserves held public values while an incomplete engine cache hydrates.
import type { Author, NoteRow, Row } from './protocol.ts';
import { type PublicSnapshot, SNAPSHOT_ROWS } from './public-snapshot-store.ts';

const author = (old: Author, next: Author): Author =>
  old.pubkey === next.pubkey && old.profileId && !next.profileId ? { ...next, ...old } : next;
function note(old: NoteRow, next: NoteRow): NoteRow {
  return {
    ...next,
    author: author(old.author, next.author),
    quotes: next.quotes.map((quote) => {
      const previous = old.quotes.find((value) => value.id === quote.id);
      return (quote.state === 'loading' || quote.state === 'missing') && previous?.state === 'ok'
        ? previous
        : quote;
    }),
  };
}
export function mergePublicRow(old: Row, next: Row): Row {
  if (old.kind !== next.kind || old.key !== next.key) return next;
  if (old.kind === 'note' && next.kind === 'note') return note(old, next);
  if (old.kind === 'notification' && next.kind === 'notification')
    return {
      ...next,
      actors: next.actors.map((value) => {
        const previous = old.actors.find((person) => person.pubkey === value.pubkey);
        return previous ? author(previous, value) : value;
      }),
      ...(old.note && next.note ? { note: note(old.note, next.note) } : {}),
    };
  if ('author' in old && 'author' in next && old.author && next.author)
    return { ...next, author: author(old.author, next.author) };
  return next;
}

export function capturePublicWindow(
  rows: readonly Row[],
  reading: string | undefined,
  atTop: boolean,
  atBottom: boolean,
): PublicSnapshot | undefined {
  if (!rows.length || rows.some((row) => row.kind === 'note' && row.pending)) return;
  const index = reading ? rows.findIndex((row) => row.key === reading) : 0;
  const start = Math.max(0, index - 8);
  const slice = rows.slice(start, start + SNAPSHOT_ROWS);
  const anchor =
    slice.find((row) => row.kind === 'note' || row.kind === 'notification') ?? slice[0];
  if (!anchor) return;
  return {
    rows: slice,
    anchor: anchor.key,
    atTop: atTop && start === 0,
    atBottom: atBottom && start + slice.length === rows.length,
  };
}
