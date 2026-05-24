import {
  finalizeEvent,
  getPublicKey,
  type EventTemplate,
  type NostrEvent,
} from '../../src/lib/protocol';

export const secretKeyHex = '01'.repeat(32);
export const otherSecretKeyHex = '02'.repeat(32);
export const pubkey = getPublicKey(secretKeyHex);

export function testEvent(patch: Partial<EventTemplate> = {}): NostrEvent {
  return finalizeEvent(
    {
      created_at: 100,
      kind: 1,
      tags: [],
      content: 'test event',
      ...patch,
    },
    secretKeyHex,
  );
}
