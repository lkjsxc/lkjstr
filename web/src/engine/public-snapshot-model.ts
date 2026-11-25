// Reconciliation preserves held public values while an incomplete engine cache hydrates.
import type { Author, LinkPreview, NoteRow, Row } from './protocol.ts';
import { mergePublicCounts } from './public-snapshot-counts.ts';
import { type PublicSnapshot, SNAPSHOT_ROWS, snapshotSafe } from './public-snapshot-store.ts';

const author = (old: Author, next: Author): Author =>
  old.pubkey === next.pubkey && old.profileId && !next.profileId ? { ...next, ...old } : next;
const authors = (old: readonly Author[], next: readonly Author[]): readonly Author[] =>
  next.map((value) => {
    const previous = old.find((person) => person.pubkey === value.pubkey);
    return previous ? author(previous, value) : value;
  });
function previews(
  old: readonly LinkPreview[] | undefined,
  next: readonly LinkPreview[] | undefined,
): readonly LinkPreview[] | undefined {
  return (
    next?.map((card) => {
      const previous = old?.find((value) => value.source === card.source);
      return (card.kind === 'loading' || card.kind === 'link') &&
        (previous?.kind === 'page' || previous?.kind === 'post')
        ? previous
        : card;
    }) ?? old
  );
}
function note(old: NoteRow, next: NoteRow): NoteRow {
  if (next.hidden) return next;
  return {
    ...next,
    ...mergePublicCounts(old, next),
    author: author(old.author, next.author),
    ...(old.replyTo && next.replyTo && old.replyTo.id === next.replyTo.id
      ? { replyTo: { ...next.replyTo, author: author(old.replyTo.author, next.replyTo.author) } }
      : {}),
    ...(old.repostedBy && next.repostedBy
      ? {
          repostedBy: {
            ...next.repostedBy,
            actors: authors(old.repostedBy.actors, next.repostedBy.actors),
          },
        }
      : {}),
    previews: previews(old.previews, next.previews),
    quotes: next.quotes.map((quote) => {
      const previous = old.quotes.find((value) => value.id === quote.id);
      if (previous?.state !== 'ok') return quote;
      if (quote.state === 'loading' || quote.state === 'missing') return previous;
      return quote.state === 'ok'
        ? {
            ...quote,
            author: author(previous.author, quote.author),
            previews: previews(previous.previews, quote.previews),
          }
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
      actors: authors(old.actors, next.actors),
      ...(old.note && next.note ? { note: note(old.note, next.note) } : {}),
    };
  if (
    old.kind === 'profile' &&
    next.kind === 'profile' &&
    old.author.profileId &&
    !next.author.profileId
  )
    return {
      ...next,
      author: author(old.author, next.author),
      banner: old.banner,
      about: old.about,
      website: old.website,
      lud16: old.lud16,
      updatedAt: old.updatedAt,
      since: next.since ?? old.since,
      relays: old.relays,
      following: next.following ?? old.following,
      followers: next.followers ?? old.followers,
      notes: next.notes ?? old.notes,
    };
  if (
    old.kind === 'person' &&
    next.kind === 'person' &&
    old.author.profileId &&
    !next.author.profileId
  )
    return { ...next, author: author(old.author, next.author), about: old.about };
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
  if (!anchor || !slice.every(snapshotSafe)) return;
  return {
    rows: slice,
    anchor: anchor.key,
    atTop: atTop && start === 0,
    atBottom: atBottom && start + slice.length === rows.length,
  };
}
