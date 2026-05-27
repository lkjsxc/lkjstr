import { beforeEach, describe, expect, it } from 'vitest';
import { threadWindowSize } from '../../../src/lib/events/feed-window';
import { clearEventRepositoryForTests } from '../../../src/lib/events/repository';
import type { NostrEvent } from '../../../src/lib/protocol';
import { stubOrchestrator } from '../relays/orchestration/orchestrator-mock';
import { loadOlderThreadPage } from '../../../src/lib/thread/thread-runtime-pages';
import { loadNewerThreadPage } from '../../../src/lib/thread/thread-runtime-pages-newer';
import { storeThreadEvent } from '../../../src/lib/thread/thread-store';

describe('thread runtime pages', () => {
  beforeEach(() => clearEventRepositoryForTests());

  it('recovers newer replies after older paging prunes the top window', async () => {
    const root = 'f'.repeat(64);
    const items = Array.from({ length: threadWindowSize }, (_, index) => ({
      event: reply(String(index + 1), 500 - index, root),
      relays: ['cache'],
    }));
    for (const item of items) await storeThreadEvent(item.event, item.relays);
    const older = { event: reply('older', 260, root), relays: ['cache'] };
    await storeThreadEvent(older.event, older.relays);

    const olderPage = await loadOlderThreadPage({
      eventId: root,
      rootId: root,
      items,
      relays: [],
      owner: 'thread-test',
      cursor: {
        createdAt: items.at(-1)!.event.created_at,
        id: items.at(-1)!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
    });
    expect(olderPage.pruned).toBe(true);
    expect(olderPage.items[0]?.event.created_at).toBe(499);

    const newerPage = await loadNewerThreadPage({
      eventId: root,
      rootId: root,
      items: olderPage.items,
      relays: [],
      owner: 'thread-test',
      cursor: {
        createdAt: olderPage.items[0]!.event.created_at,
        id: olderPage.items[0]!.event.id,
      },
      pageSize: 30,
      subscriptions: emptySubscriptions(),
    });
    expect(newerPage.pruned).toBe(true);
    expect(newerPage.items[0]?.event.created_at).toBe(500);
  });
});

function emptySubscriptions() {
  return stubOrchestrator();
}

function reply(seed: string, created_at: number, root: string): NostrEvent {
  const id = [...seed]
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at,
    kind: 1,
    tags: [['e', root]],
    content: seed,
    sig: 'b'.repeat(128),
  };
}
