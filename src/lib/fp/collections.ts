export function upsertSetItem<T>(
  items: readonly T[],
  item: T,
  key: (item: T) => string,
): T[] {
  const id = key(item);
  const index = items.findIndex((value) => key(value) === id);
  if (index < 0) return [...items, item];
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}
