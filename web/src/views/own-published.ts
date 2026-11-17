// A successfully published own note is an explicit fresh-head want for an open Global feed.
// This is local UI intent only: the engine still owns all relay request planning.
const watchers = new Set<(account: string) => void>();
export function ownPublished(account: string): void {
  if (account) for (const watch of watchers) watch(account);
}
export function onOwnPublished(watch: (account: string) => void): () => void {
  watchers.add(watch);
  return () => void watchers.delete(watch);
}
