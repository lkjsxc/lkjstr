// Source capabilities shared by feed controls and chronological rendering.
export const CHILD = new Set([
  'thread',
  'profile',
  'hashtag',
  'following',
  'followers',
  'channel',
  'relay',
]);
export const FILTERED = new Set([
  'their-home',
  'home',
  'global',
  'hashtag',
  'relay',
  'bookmarks',
  'search',
  'profile',
]);
export const DATED = new Set(
  [...FILTERED].filter((kind) => !['search', 'bookmarks'].includes(kind)).concat('channel'),
);
export const OWN = new Set(['home', 'notifications', 'bookmarks']);
// Chronological lists the engine may index for the time rail (docs/time-rail.md). Bookmarks keep list-owner order and
// threads their reply tree; people, channels and settings are not dated lists.
export const RAILED = new Set([...DATED, 'notifications', 'search']);

export const hasDaySeparators = (kind: string, show?: string): boolean =>
  DATED.has(kind) && !['reposts', 'reactions'].includes(show ?? '');
