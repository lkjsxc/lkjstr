import { type NostrTag } from './event';
import { kinds } from './kinds';
import { normalizeRelayUrl } from './relay-url';

export type ClientTagConfig = {
  readonly enabled: boolean;
  readonly name: string;
  readonly address: string;
  readonly relay: string;
};

export function appendClientTag(
  tags: readonly NostrTag[],
  config: ClientTagConfig,
  kind: number,
): readonly NostrTag[] {
  const without = tags.filter((tag) => tag[0] !== 'client');
  const tag = clientTagParts(config, kind);
  return tag ? [...without, tag] : without;
}

export function clientTagParts(
  config: ClientTagConfig,
  kind: number,
): NostrTag | undefined {
  if (!config.enabled || !clientTagAllowedForKind(kind)) return undefined;
  const name = config.name.trim();
  const address = handlerAddress(config.address);
  const relay = normalizeRelayUrl(config.relay);
  if (!name || !address || !relay) return undefined;
  return ['client', name, address, relay];
}

export function clientTagAllowedForKind(kind: number): boolean {
  if (
    kind === kinds.httpAuth ||
    kind === kinds.relayAuth ||
    kind === kinds.blossomAuth
  )
    return false;
  return kind < 20_000 || kind >= 30_000;
}

function handlerAddress(value: string): string | undefined {
  const [kind, pubkey, identifier] = value.trim().split(/:(.*?):(.*)/u);
  const normalizedPubkey = pubkey?.toLowerCase();
  if (Number(kind) !== kinds.handlerInformation) return undefined;
  if (!normalizedPubkey || !/^[0-9a-f]{64}$/u.test(normalizedPubkey))
    return undefined;
  if (!identifier?.trim()) return undefined;
  return `${kinds.handlerInformation}:${normalizedPubkey}:${identifier.trim()}`;
}
