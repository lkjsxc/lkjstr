import { createHash } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';
import { isHex } from '../nostr-enqueue.mjs';

export const ORIGIN = 'https://lkjstr.lkjsxc.com';
export const APP = '160b7d028b99ef2530be8718d03cb0be6f9449fb74d5ae8d6f09a060c63048b1';
export const NPUB = 'npub1zc9h6q5tn8hj2v97suvdq09shehegj0mwn26art0pxsxp33sfzcs8m6k5w';
export const HANDLER = `31990:${APP}:lkjstr`;
export const RELAYS = ['wss://relay.damus.io/', 'wss://nos.lol/', 'wss://yabu.me/',
  'wss://relay.primal.net/', 'wss://relay.ditto.pub/'];

export function eventDigest({ pubkey, created_at, kind, tags, content }) {
  return createHash('sha256').update(JSON.stringify([0, pubkey, created_at, kind, tags, content])).digest();
}

export function validEvent(event) {
  if (!isHex(event?.id, 64) || !isHex(event.pubkey, 64) || !isHex(event.sig, 128) ||
      !Number.isSafeInteger(event.created_at) || event.created_at < 0 ||
      !Number.isInteger(event.kind) || event.kind < 0 || event.kind > 65535 ||
      typeof event.content !== 'string' || !Array.isArray(event.tags) ||
      !event.tags.every(tag => Array.isArray(tag) && tag.length && tag.every(item => typeof item === 'string'))) {
    return false;
  }
  const digest = eventDigest(event);
  if (digest.toString('hex') !== event.id) return false;
  try {
    return schnorr.verify(Buffer.from(event.sig, 'hex'), digest, Buffer.from(event.pubkey, 'hex'));
  } catch {
    return false;
  }
}

const fields = ['id', 'pubkey', 'kind', 'created_at', 'tags', 'content', 'sig'];
export const eventFields = event => Object.fromEntries(fields.map(field => [field, event[field]]));

export function sameEvent(left, right) {
  return Boolean(right) && fields.every(key => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}
