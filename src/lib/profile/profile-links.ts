import { normalizeRelayUrl, type NostrEvent } from '$lib/protocol';
import type { RelaySet } from '$lib/relays/relay-store';

export function normalizedProfileWebsite(value?: string | null): string {
  const text = value?.trim();
  if (!text) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/iu.test(text)
    ? text
    : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function followingCount(followList?: NostrEvent | null): number {
  if (followList?.kind !== 3) return 0;
  return new Set(
    followList.tags
      .filter((tag) => tag[0] === 'p' && /^[0-9a-f]{64}$/iu.test(tag[1] ?? ''))
      .map((tag) => tag[1]!.toLowerCase()),
  ).size;
}

export function followListCopyJson(followList?: NostrEvent | null): string {
  return JSON.stringify(followList ?? null, null, 2);
}

export function relaySetsCopyJson(relaySets: readonly RelaySet[]): string {
  return JSON.stringify(
    relaySets.map((set) => ({
      id: set.id,
      name: set.name,
      default: Boolean(set.isDefault),
      relays: set.relays.map((relay) => ({
        url: normalizeRelayUrl(relay.url) ?? relay.url,
        enabled: relay.enabled,
        read: relay.read,
        write: relay.write,
      })),
    })),
    null,
    2,
  );
}
