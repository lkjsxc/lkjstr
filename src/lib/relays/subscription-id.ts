import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { FeedCursorPoint } from '../events/types';

export const maxRelaySubscriptionIdLength = 48;

export function relaySubscriptionHash(value: unknown, length = 12): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return bytesToHex(sha256(new TextEncoder().encode(text))).slice(0, length);
}

export function compactRelaySubscriptionId(
  prefix: string,
  topic: string,
  discriminator?: unknown,
): string {
  const parts = discriminator
    ? [prefix, topic, relaySubscriptionHash(discriminator)]
    : [prefix, topic];
  const id = parts.join(':');
  if (id.length <= maxRelaySubscriptionIdLength) return id;
  return `${prefix.slice(0, 8)}:${topic.slice(0, 10)}:${relaySubscriptionHash(id, 16)}`;
}

export function childRelaySubscriptionId(
  parent: string,
  topic: string,
  discriminator?: unknown,
): string {
  return compactRelaySubscriptionId(parent, topic, discriminator);
}

export function liveRelaySubscriptionId(prefix: string, topic: string): string {
  return compactRelaySubscriptionId(prefix, topic);
}

export function initialRelaySubscriptionId(
  prefix: string,
  discriminator?: unknown,
): string {
  return compactRelaySubscriptionId(prefix, 'initial', discriminator);
}

export function olderRelaySubscriptionId(
  prefix: string,
  cursor: FeedCursorPoint | number,
): string {
  return compactRelaySubscriptionId(prefix, 'older', cursor);
}

export function newerRelaySubscriptionId(
  prefix: string,
  cursor: FeedCursorPoint | number,
): string {
  return compactRelaySubscriptionId(prefix, 'newer', cursor);
}

export function relaySubscriptionIdValid(id: string): boolean {
  return id.length > 0 && id.length <= maxRelaySubscriptionIdLength;
}
