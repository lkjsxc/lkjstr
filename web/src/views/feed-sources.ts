// Source capabilities shared by feed controls and chronological rendering.
export const CHILD = new Set(['thread', 'profile', 'hashtag', 'following', 'followers', 'channel']);
export const FILTERED = new Set([
  'their-home',
  'home',
  'global',
  'hashtag',
  'bookmarks',
  'search',
  'profile',
]);
export const DATED = new Set(
  [...FILTERED].filter((kind) => !['search', 'bookmarks'].includes(kind)).concat('channel'),
);
export const OWN = new Set(['home', 'notifications', 'bookmarks']);

export const hasDaySeparators = (kind: string, show?: string): boolean =>
  DATED.has(kind) && !['reposts', 'reactions'].includes(show ?? '');
