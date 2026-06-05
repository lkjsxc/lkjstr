export const kinds = {
  metadata: 0,
  textNote: 1,
  recommendRelay: 2,
  followList: 3,
  deletion: 5,
  repost: 6,
  reaction: 7,
  genericRepost: 16,
  relayListMetadata: 10002,
  zapRequest: 9734,
  zapReceipt: 9735,
  httpAuth: 27235,
  relayAuth: 22242,
  blossomAuth: 24242,
} as const;

export function isReplaceableKind(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10_000 && kind < 20_000);
}

export function isEphemeralKind(kind: number): boolean {
  return kind >= 20_000 && kind < 30_000;
}

export function isAddressableKind(kind: number): boolean {
  return kind >= 30_000 && kind < 40_000;
}
