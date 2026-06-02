import { kinds } from '../../protocol';
import {
  actionStateForFeed,
  type EventActionState,
} from '../../events/action-state';
import { isActionKind } from '../../events/action-cache-signal';
import { sqliteIndexedPage } from '../sqlite-opfs/event-pages-sqlite';

const actionKinds = [
  kinds.reaction,
  kinds.repost,
  kinds.genericRepost,
] as const;

const indexLimit = 2000;

export async function loadActionStateIndex(
  pubkey: string,
): Promise<Map<string, EventActionState>> {
  const rows =
    (await sqliteIndexedPage(
      { kind: 'profile', authors: [pubkey], kinds: actionKinds },
      indexLimit,
    ).catch(() => undefined)) ?? [];
  const events = rows.filter((event) => isActionKind(event.kind));
  return actionStateForFeed(
    events.map((event) => ({ event })),
    pubkey,
  );
}
