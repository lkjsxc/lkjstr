import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from './bytes';
import type { UnsignedNostrEvent } from './event';

export function serializeEvent(event: UnsignedNostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function computeEventId(event: UnsignedNostrEvent): string {
  return bytesToHex(sha256(utf8ToBytes(serializeEvent(event))));
}
