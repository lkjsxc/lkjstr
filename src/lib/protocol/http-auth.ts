import type { NostrTag, UnsignedNostrEvent } from './event';
import { kinds } from './kinds';

export function httpAuthEvent(input: {
  pubkey: string;
  url: string;
  method: string;
  payloadHash?: string;
  now?: number;
}): UnsignedNostrEvent {
  const tags: NostrTag[] = [
    ['u', input.url],
    ['method', input.method.toUpperCase()],
  ];
  if (input.payloadHash) tags.push(['payload', input.payloadHash]);
  return {
    pubkey: input.pubkey,
    created_at: input.now ?? Math.floor(Date.now() / 1000),
    kind: kinds.httpAuth,
    tags,
    content: '',
  };
}

export function nostrAuthorizationHeader(event: unknown): string {
  const text = JSON.stringify(event);
  const encoded =
    typeof btoa === 'function'
      ? btoa(text)
      : Buffer.from(text, 'utf8').toString('base64');
  return `Nostr ${encoded}`;
}
