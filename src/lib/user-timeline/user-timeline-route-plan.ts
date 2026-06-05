export function userTimelineRouteFingerprint(input: {
  readonly targetPubkey: string;
  readonly selectedRelays: readonly string[];
  readonly authorSetHash: string;
}): string {
  return [
    'user-timeline',
    input.targetPubkey,
    input.authorSetHash,
    ...input.selectedRelays.slice().sort(),
  ].join('|');
}

export function userTimelineSemanticKey(input: {
  readonly targetPubkey: string;
  readonly mode: 'follow_graph' | 'target_posts_only';
}): string {
  return `user-timeline:${input.mode}:${input.targetPubkey}`;
}
