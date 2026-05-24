import { computeEventId } from './event-id';
import type { NostrEvent, NostrTag, UnsignedNostrEvent } from './event';
import { getPublicKey, signSchnorrHex } from './crypto';

export type EventTemplate = Omit<UnsignedNostrEvent, 'pubkey'> & {
  readonly pubkey?: string;
};

export function finalizeEvent(
  template: EventTemplate,
  secretKey: Uint8Array | string,
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  if (template.pubkey && template.pubkey !== pubkey)
    throw new Error('event pubkey does not match secret key');
  const unsigned = {
    pubkey,
    created_at: template.created_at,
    kind: template.kind,
    tags: cloneTags(template.tags),
    content: template.content,
  };
  const id = computeEventId(unsigned);
  return { ...unsigned, id, sig: signSchnorrHex(id, secretKey) };
}

export function signEventWithSecretHex(
  event: UnsignedNostrEvent,
  secretKeyHex: string,
): NostrEvent {
  return finalizeEvent(event, secretKeyHex);
}

function cloneTags(tags: readonly NostrTag[]): NostrTag[] {
  return tags.map((tag) => [...tag]);
}
