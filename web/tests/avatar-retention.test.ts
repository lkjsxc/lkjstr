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

it('evicts only unowned pictures, oldest first, once the session holds more than 1024 URLs', () => {
  const x = avatarFixture(),
    owned = vi.fn();
  x.client.acquire('https://a.test/owned', owned);
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const urls: string[] = [];
  for (let index = 0; index < 1023; index++) {
    const draw = vi.fn();
    const close = x.client.acquire(`https://a.test/idle-${index}`, draw)!;
    x.reply(x.wants().at(-1)!.req, { status: 'ready', retained: true });
    urls.push(draw.mock.lastCall![0].url);
    close();
  }
  expect(x.revoked).not.toHaveBeenCalled();
  for (const name of ['more-0', 'more-1']) {
    x.client.acquire(`https://a.test/${name}`, () => undefined);
    x.reply(x.wants().at(-1)!.req, { status: 'ready', retained: true });
  }
  expect(x.revoked.mock.calls.map(([url]) => url)).toEqual([urls[0], urls[1]]);
  expect(owned.mock.lastCall![0].kind).toBe('ready');
  const wants = x.wants().length,
    newest = vi.fn();
  x.client.acquire('https://a.test/idle-1022', newest);
  expect(newest.mock.lastCall![0]).toEqual({ kind: 'ready', url: urls[1022] });
  expect(x.wants()).toHaveLength(wants);
  x.client.acquire('https://a.test/idle-0', () => undefined);
  expect(x.wants()).toHaveLength(wants + 1);
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

it('keeps idle and live pictures through hide and rejects only the cancelled pending reply', () => {
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
  expect(x.revoked).not.toHaveBeenCalled();
  expect(active.mock.lastCall![0].kind).toBe('ready');
  x.reply(pending!.req, { status: 'ready', retained: true });
  expect(x.created).toHaveBeenCalledTimes(2);
  x.client.visible(true);
  expect(x.wants().map((want) => want.url)).toEqual([
    'https://a.test/hide-idle',
    'https://a.test/hide-live',
    'https://a.test/hide-pending',
    'https://a.test/hide-pending',
  ]);
  const next = vi.fn();
  x.client.acquire('https://a.test/hide-idle', next);
  expect(next.mock.lastCall![0].kind).toBe('ready');
});

it('discards a deferred entry immediately on last-owner release', () => {
  const x = avatarFixture(),
    url = 'https://a.test/non-ready-deferred';
  const release = x.client.acquire(url, () => undefined)!;
  const first = x.wants()[0]!;
  x.reply(first.req, { status: 'deferred', retryMs: 60_000 });
  release();
  const next = vi.fn();
  x.client.acquire(url, next);
  expect(next).toHaveBeenCalledExactlyOnceWith({ kind: 'pending' });
  expect(x.wants()).toHaveLength(2);
  expect(x.wants()[1]!.req).not.toBe(first.req);
  expect(x.created).not.toHaveBeenCalled();
});

it('answers a returning face with the known fallback at once and asks again after two minutes', () => {
  const x = avatarFixture(),
    url = 'https://a.test/non-ready-fallback';
  let now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  x.client.acquire(url, () => undefined)!();
  expect(x.sent.at(-1)).toEqual({ t: 'avatar.close', req: x.wants()[0]!.req });
  const release = x.client.acquire(url, () => undefined)!;
  x.reply(x.wants()[1]!.req, { status: 'fallback', uniform: false });
  release();
  const again = vi.fn();
  x.client.acquire(url, again)!();
  expect(again).toHaveBeenCalledExactlyOnceWith({ kind: 'fallback', uniform: false });
  expect(x.wants()).toHaveLength(2);
  now += 120_001;
  const later = vi.fn();
  x.client.acquire(url, later);
  expect(later).toHaveBeenCalledExactlyOnceWith({ kind: 'pending' });
  expect(x.wants()).toHaveLength(3);
});
