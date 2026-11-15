import { afterEach, expect, it } from 'vitest';
import type { NotificationRow } from '../src/engine/protocol.ts';
import { createFresh } from '../src/views/feed-fresh.ts';
import { person, setup } from './wishes-support.ts';

afterEach(() => document.body.replaceChildren());

it('reads new rows and grouped actors at the same timestamp without looping on an unacknowledged row', async () => {
  const x = setup();
  const fresh = createFresh(x.el, x.env, 'notifications', () => {});
  const row: NotificationRow = {
    kind: 'notification',
    key: 'one',
    type: 'reaction',
    at: 1000,
    actors: [person],
    others: 0,
    unread: true,
  };
  fresh.read([row]);
  await Promise.resolve();
  fresh.read([row]);
  expect(x.act).toHaveBeenCalledTimes(1);
  fresh.read([{ ...row, key: 'two' }]);
  await Promise.resolve();
  expect(x.act).toHaveBeenCalledTimes(2);
  fresh.read([{ ...row, key: 'two', actors: [person, { ...person, pubkey: 'b'.repeat(64) }] }]);
  await Promise.resolve();
  expect(x.act).toHaveBeenCalledTimes(3);
  fresh.read([{ ...row, unread: false }]);
  fresh.read([row]);
  await Promise.resolve();
  expect(x.act).toHaveBeenCalledTimes(4);
  fresh.dispose();
});
