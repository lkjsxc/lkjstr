// Canonical display and toggle identity for NIP-25 reaction aliases.
import type { Reaction } from '../engine/protocol.ts';
export const reactionLabel = (value: string): string =>
  value === '+' || value === '' || value === '❤' ? '❤️' : value === '-' ? '👎' : value;
export function groupReactions(rows: readonly Reaction[]): Reaction[] {
  const groups = new Map<string, Reaction>(); // bound: reactions of one row
  for (const row of rows) {
    const emoji = reactionLabel(row.emoji);
    const url = row.emoji.startsWith(':') ? row.url : undefined;
    const key = `${emoji}\0${url ?? ''}`;
    const old = groups.get(key);
    groups.set(key, {
      ...row,
      emoji,
      url,
      count: row.count + (old?.count ?? 0),
      mine: row.mine || !!old?.mine,
    });
  }
  return [...groups.values()];
}
