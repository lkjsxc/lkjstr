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
  return `Nostr ${base64Utf8(text)}`;
}

function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + chunkSize));
  }
  return btoa(binary);
}
