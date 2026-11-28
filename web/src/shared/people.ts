// Public author view models, bounded to 4000, for tab search and in-place face updates.
import type { Author, Row } from '../engine/protocol.ts';

const people = new Map<string, Author>();
const listeners = new Set<(author: Author) => void>();
export const knownPeople = (): readonly Author[] => [...people.values()];
export const knownPerson = (pubkey: string): Author | undefined => people.get(pubkey);
export const onPerson = (fn: (a: Author) => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function learnPerson(author: Author): Author {
  const old = people.get(author.pubkey);
  // A metadata-less engine response must not erase the remembered face before hydration.
  const next = !author.profileId && !author.picture && old ? { ...author, ...old } : author;
  if (JSON.stringify(old) === JSON.stringify(next)) return next;
  people.set(author.pubkey, next);
  if (people.size > 4000) people.delete(people.keys().next().value ?? '');
  for (const listener of listeners) listener(next);
  return next;
}
/** Only positive engine metadata-deletion evidence may clear a hydrated author. */
export function invalidatePeople(profileIds: ReadonlySet<string>): void {
  for (const [pubkey, value] of people) {
    if (!value.profileId || !profileIds.has(value.profileId)) continue;
    const fallback: Author = {
      pubkey,
      npub: value.npub,
      name: '',
      ...(value.muted ? { muted: true } : {}),
    };
    people.set(pubkey, fallback);
    for (const listener of listeners) listener(fallback);
  }
}

export function learnRows(rows: readonly Row[]): void {
  for (const row of rows) {
    if ('author' in row && row.author) learnPerson(row.author);
    if (row.kind === 'notification') {
      row.actors.forEach(learnPerson);
      if (row.note) learnRows([row.note]);
    }
    if (row.kind === 'profile') row.knownFollowers?.actors.forEach(learnPerson);
    if (row.kind === 'channel') {
      if (row.creator) learnPerson(row.creator);
      if (row.last) learnPerson(row.last.author);
    }
    if (row.kind === 'note') {
      if (row.replyTo) learnPerson(row.replyTo.author);
      row.repostedBy?.actors.forEach(learnPerson);
      for (const quote of row.quotes) if (quote.state === 'ok') learnPerson(quote.author);
    }
  }
}
