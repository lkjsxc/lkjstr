import { isPubkey, normalizeRelayUrl, type NostrEvent } from '$lib/protocol';

export type FolloweeEntry = {
  readonly pubkey: string;
  readonly relayUrl?: string;
  readonly petname?: string;
};

export function followeeEntries(
  followList?: NostrEvent | null,
): FolloweeEntry[] {
  if (followList?.kind !== 3) return [];
  const entries = new Map<string, FolloweeEntry>();
  for (const tag of followList.tags) {
    const pubkey = tag[0] === 'p' ? tag[1]?.toLowerCase() : undefined;
    if (!pubkey || !isPubkey(pubkey) || entries.has(pubkey)) continue;
    entries.set(pubkey, {
      pubkey,
      relayUrl: relayHint(tag[2]),
      petname: textHint(tag[3]),
    });
  }
  return [...entries.values()];
}

function relayHint(value: string | undefined): string | undefined {
  return value ? (normalizeRelayUrl(value) ?? undefined) : undefined;
}

function textHint(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
