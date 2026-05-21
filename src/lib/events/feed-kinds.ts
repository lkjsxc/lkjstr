import { kinds } from '../protocol';

export const feedDisplayKinds = [
  kinds.textNote,
  kinds.repost,
  kinds.genericRepost,
] as const;

export function isFeedDisplayKind(kind: number): boolean {
  return (feedDisplayKinds as readonly number[]).includes(kind);
}
