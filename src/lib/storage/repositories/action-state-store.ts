import { browserDb } from '../browser-db';
import { kinds, type NostrEvent } from '../../protocol';
import { normalizeStoredEvent } from '../../events/normalize';
import {
  actionStateForFeed,
  type EventActionState,
} from '../../events/action-state';
import { isActionKind } from '../../events/action-cache-signal';

const actionKinds = [
  kinds.reaction,
  kinds.repost,
  kinds.genericRepost,
] as const;

const indexLimit = 2000;

export async function loadActionStateIndex(
  pubkey: string,
): Promise<Map<string, EventActionState>> {
  const byId = new Map<string, NostrEvent>();
  for (const kind of actionKinds) {
    const rows = await browserDb()
      .events.where('[pubkey+kind+created_at]')
      .between([pubkey, kind, 0], [pubkey, kind, Number.MAX_SAFE_INTEGER])
      .reverse()
      .limit(indexLimit)
      .toArray();
    for (const row of rows) {
      const event = normalizeStoredEvent(row);
      if (isActionKind(event.kind)) byId.set(event.id, event);
    }
  }
  return actionStateForFeed(
    [...byId.values()].map((event) => ({ event })),
    pubkey,
  );
}
