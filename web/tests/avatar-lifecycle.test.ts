import { afterEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { avatarFixture, resetAvatarFixtures } from './avatar-support.ts';
import { account } from './vault-ui-fixture.ts';

afterEach(resetAvatarFixtures);

it('flushes idle and active URLs on pagehide and resumes fresh after BFCache return', () => {
  const x = avatarFixture(),
    active = vi.fn();
  const close = x.client.acquire('https://a.test/idle-pagehide', () => undefined)!;
  x.client.acquire('https://a.test/live-pagehide', active);
  for (const want of x.wants()) x.reply(want.req, { status: 'ready', retained: true });
  close();
  const event = new Event('pagehide');
  Object.defineProperty(event, 'persisted', { value: true });
  window.dispatchEvent(event);
  expect(x.revoked).toHaveBeenCalledTimes(2);
  expect(active.mock.lastCall![0].kind).toBe('pending');
  window.dispatchEvent(new Event('pageshow'));
  expect(x.wants()).toHaveLength(3);
  expect(x.wants()[2]!.url).toBe('https://a.test/live-pagehide');
});

it('prevents old owners from repopulating the idle cache after reset', () => {
  const x = avatarFixture(),
    draw = vi.fn();
  const release = x.client.acquire('https://a.test/reset', draw)!;
  const old = x.wants()[0]!;
  x.reply(old.req, { status: 'ready', retained: true });
  x.client.reset();
  expect(draw.mock.lastCall![0].kind).toBe('pending');
  expect(x.revoked).toHaveBeenCalledTimes(1);
  const next = x.wants()[1]!;
  x.reply(old.req, { status: 'ready', retained: true });
  expect(x.created).toHaveBeenCalledTimes(1);
  x.reply(next.req, { status: 'ready', retained: true });
  release();
  expect(x.revoked).toHaveBeenCalledTimes(2);
  x.client.acquire('https://a.test/reset', draw);
  expect(draw.mock.lastCall![0].kind).toBe('pending');
  expect(x.wants()).toHaveLength(3);
});

it.each(['hide', 'dispose'] as const)('honors reentrant %s while resetting', (action) => {
  const x = avatarFixture();
  let resetting = false;
  x.client.acquire('https://a.test/reset-reentrant', (value) => {
    if (resetting && value.kind === 'pending') {
      resetting = false;
      if (action === 'hide') x.client.visible(false);
      else x.client.dispose();
    }
  });
  x.client.acquire('https://a.test/reset-other', () => undefined);
  for (const want of x.wants()) x.reply(want.req, { status: 'ready', retained: true });
  resetting = true;
  x.client.reset();
  expect(x.revoked).toHaveBeenCalledTimes(2);
  expect(x.wants()).toHaveLength(2);
});

it('flushes avatars on authoritative account removal, including another tab, but not a rename', () => {
  const x = avatarFixture(),
    sent: ToEngine[] = [];
  let receive!: (message: FromEngine) => void;
  const engine = createEngine({
    post: (message) => sent.push(message),
    listen: (listener) => {
      receive = listener;
    },
    close() {},
  });
  try {
    const me = account();
    receive({ t: 'accounts', accounts: [me], active: me.author.pubkey });
    const draw = vi.fn();
    engine.avatars.acquire('https://a.test/account-owned', draw);
    const want = sent.find((m) => m.t === 'avatar.want')!;
    if (want.t !== 'avatar.want') throw new Error('missing avatar request');
    const blob = new Blob(['still'], { type: 'image/webp' });
    receive({
      t: 'avatar',
      req: want.req,
      result: { status: 'ready', retained: true },
      blob,
      image: { edge: 1, sourceWidth: 1, sourceHeight: 1, bytes: blob.size, mime: blob.type },
    });
    const value = draw.mock.lastCall![0];
    receive({
      t: 'accounts',
      accounts: [{ ...me, author: { ...me.author, name: 'Renamed' } }],
      active: me.author.pubkey,
    });
    expect(draw.mock.lastCall![0]).toEqual(value);
    expect(x.revoked).not.toHaveBeenCalled();
    receive({ t: 'accounts', accounts: [] });
    expect(draw.mock.lastCall![0].kind).toBe('pending');
    expect(x.revoked).toHaveBeenCalledExactlyOnceWith(value.url);
    expect(sent.filter((message) => message.t === 'avatar.want')).toHaveLength(2);
  } finally {
    engine.dispose();
  }
});
