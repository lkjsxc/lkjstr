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
export const DATED = new Set([...FILTERED, 'channel']);
export const OWN = new Set(['home', 'notifications', 'bookmarks']);
