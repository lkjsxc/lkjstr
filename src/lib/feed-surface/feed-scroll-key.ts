export const missingFeedRowKey = '__feed-row-missing__';

export function safeFeedRowKey(
  item: unknown,
  getKey: (item: unknown) => string,
): string {
  if (item === undefined || item === null) return missingFeedRowKey;
  return getKey(item);
}
