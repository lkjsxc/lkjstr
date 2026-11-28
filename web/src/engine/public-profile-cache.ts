// A profile header is independent of the selected event kind. Reuse only public
// snapshots in the same query/account/render scope; never borrow sibling notes.
import type { Query } from './protocol.ts';
import {
  type PublicSnapshot,
  readPublicSnapshot,
  snapshotIdentity,
} from './public-snapshot-store.ts';

export function profileSiblings(
  query: Query,
  language: string,
  previews: boolean,
  visitorFilter: boolean,
): readonly string[] {
  if (query.source !== 'profile' || (!query.pubkey && !query.ref)) return [];
  const kinds = [
    'posts',
    'replies',
    'reposts',
    'reactions',
    'media',
    'articles',
    'lists',
    'all',
  ] as const;
  const identity = (q: Query) => snapshotIdentity(q, language, previews, visitorFilter);
  const current = identity(query);
  const siblings = kinds.map((show) => identity({ ...query, show }));
  for (const reposts of [undefined, false, true])
    siblings.push(identity({ ...query, show: 'posts', reposts }));
  return [...new Set(siblings)].filter((key) => key !== current);
}

export function readProfileHeader(siblings: readonly string[]): PublicSnapshot | undefined {
  for (const identity of siblings) {
    const header = readPublicSnapshot(identity, 'top')?.rows.find((row) => row.kind === 'profile');
    if (header?.kind !== 'profile' || !header.author.profileId) continue;
    return { rows: [header], anchor: header.key, atTop: true, atBottom: false };
  }
}
