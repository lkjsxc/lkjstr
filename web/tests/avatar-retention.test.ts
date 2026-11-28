import { afterEach, expect, it, vi } from 'vitest';
import { avatarFixture, resetAvatarFixtures } from './avatar-support.ts';

afterEach(resetAvatarFixtures);

it('delivers an idle ready URL synchronously without a Worker round trip', () => {
  const x = avatarFixture(),
    first = vi.fn();
  const close = x.client.acquire('https://a.test/recent', first)!;
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const value = first.mock.lastCall![0];
  close();
  const second = vi.fn();
  x.client.acquire('https://a.test/recent', second);
  expect(second).toHaveBeenCalledExactlyOnceWith(value);
  expect(x.wants()).toHaveLength(1);
  expect(x.revoked).not.toHaveBeenCalled();
});

it('retains at most 64 idle ready URLs and evicts least-recently released ones', () => {
  const x = avatarFixture();
  for (let index = 0; index < 65; index++) {
    const close = x.client.acquire(`https://a.test/idle-${index}`, () => undefined)!;
    x.reply(x.wants().at(-1)!.req, { status: 'ready', retained: true });
    close();
  }
  expect(x.created).toHaveBeenCalledTimes(65);
  expect(x.revoked).toHaveBeenCalledTimes(1);
  const newest = vi.fn();
  x.client.acquire('https://a.test/idle-64', newest);
  expect(newest.mock.lastCall![0].kind).toBe('ready');
  expect(x.wants()).toHaveLength(65);
  x.client.acquire('https://a.test/idle-0', () => undefined);
  expect(x.wants()).toHaveLength(66);
});

it('counts idle URLs inside the 256 limit and admits by evicting idle before live URLs', () => {
  const x = avatarFixture(),
    close: (() => void)[] = [];
  for (let index = 0; index < 256; index++) {
    close.push(x.client.acquire(`https://a.test/cap-${index}`, () => undefined)!);
    x.reply(x.wants().at(-1)!.req, { status: 'ready', retained: true });
  }
  close[0]!();
  expect(x.revoked).not.toHaveBeenCalled();
  expect(x.client.acquire('https://a.test/next', () => undefined)).toBeTypeOf('function');
  expect(x.revoked).toHaveBeenCalledTimes(1);
  expect(x.client.acquire('https://a.test/over', () => undefined)).toBeUndefined();
  expect(x.wants()).toHaveLength(257);
});

it('keeps the original private provenance when an idle ready URL gains a public consumer', () => {
  const x = avatarFixture();
  const close = x.client.acquire('https://a.test/private-first', () => undefined, false)!;
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  close();
  const next = vi.fn();
  x.client.acquire('https://a.test/private-first', next, true);
  expect(x.wants()).toEqual([
    { t: 'avatar.want', req: x.wants()[0]!.req, url: 'https://a.test/private-first' },
  ]);
  expect(next.mock.lastCall![0].kind).toBe('ready');
});

it('flushes both idle and live readiness on hide and rejects old replies', () => {
  const x = avatarFixture(),
    active = vi.fn();
  const idle = x.client.acquire('https://a.test/hide-idle', () => undefined)!;
  x.client.acquire('https://a.test/hide-live', active);
  x.client.acquire('https://a.test/hide-pending', () => undefined);
  const [first, second, pending] = x.wants();
  x.reply(first!.req, { status: 'ready', retained: true });
  x.reply(second!.req, { status: 'ready', retained: true });
  idle();
  x.client.visible(false);
  expect(x.revoked).toHaveBeenCalledTimes(2);
  expect(active.mock.lastCall![0].kind).toBe('pending');
  x.reply(pending!.req, { status: 'ready', retained: true });
  expect(x.created).toHaveBeenCalledTimes(2);
  x.client.visible(true);
  expect(x.wants()).toHaveLength(5);
  const next = vi.fn();
  x.client.acquire('https://a.test/hide-idle', next);
  expect(next.mock.lastCall![0].kind).toBe('pending');
});
