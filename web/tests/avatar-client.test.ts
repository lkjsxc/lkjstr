import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AvatarValue } from '../src/engine/client-avatars.ts';
import { createAvatarClient } from '../src/engine/client-avatars.ts';
import type { AvatarOutput, ToEngine } from '../src/engine/protocol.ts';

let serial = 0;
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:avatar-${++serial}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup() {
  const sent: ToEngine[] = [];
  const client = createAvatarClient({ post: (m) => sent.push(m), listen() {}, close() {} });
  const wants = () => sent.filter((m) => m.t === 'avatar.want');
  const reply = (req: string, result: AvatarOutput['result']): void => {
    const blob = new Blob(['derived'], { type: 'image/webp' });
    client.receive({
      t: 'avatar',
      req,
      result,
      ...(result.status === 'ready'
        ? {
            blob,
            image: {
              edge: 160,
              sourceWidth: 800,
              sourceHeight: 600,
              bytes: blob.size,
              mime: blob.type,
            },
          }
        : {}),
    });
  };
  return { client, sent, wants, reply };
}
it('shares one exact-URL request and retains its last ready release until cleanup', () => {
  const x = setup(),
    a: AvatarValue[] = [],
    b: AvatarValue[] = [];
  const first = x.client.acquire('https://a.test/p?size=1', (v) => a.push(v))!;
  const second = x.client.acquire('https://a.test/p?size=1', (v) => b.push(v))!;
  expect(x.wants()).toHaveLength(1);
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  expect(a.at(-1)).toEqual(b.at(-1));
  expect(a.at(-1)?.kind).toBe('ready');
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  first();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  second();
  second();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(0);
  x.client.dispose();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});
it('fences a cancelled reply from the replacement request for the same exact URL', () => {
  const x = setup(),
    draw = vi.fn();
  const first = x.client.acquire('https://a.test/p', draw)!;
  const old = x.wants()[0]!.req;
  first();
  x.client.acquire('https://a.test/p', draw);
  const current = x.wants()[1]!.req;
  expect(current).not.toBe(old);
  expect(x.sent).toContainEqual({ t: 'avatar.close', req: old });
  x.reply(old, { status: 'ready', retained: true });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  x.reply(current, { status: 'ready', retained: false });
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(draw.mock.lastCall?.[0].kind).toBe('ready');
  x.client.dispose();
  x.reply(current, { status: 'ready', retained: true });
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});
it('waits for native capacity with one retry timer and never substitutes a fallback request', () => {
  vi.useFakeTimers();
  const x = setup(),
    draw = vi.fn();
  const release = x.client.acquire('https://a.test/p', draw)!;
  x.reply(x.wants()[0]!.req, { status: 'deferred', retryMs: 100 });
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(99);
  expect(x.wants()).toHaveLength(1);
  expect(draw.mock.calls.every(([v]) => v.kind === 'pending')).toBe(true);
  vi.advanceTimersByTime(1);
  expect(x.wants()).toHaveLength(2);
  x.reply(x.wants()[1]!.req, { status: 'deferred', retryMs: 100 });
  release();
  expect(vi.getTimerCount()).toBe(0);
  x.client.dispose();
});
it('stops admitting at 256 unsettled URLs and announces room when one settles', async () => {
  const x = setup(),
    room = vi.fn();
  x.client.onCapacity(room);
  for (let i = 0; i < 256; i++) x.client.acquire(`https://a.test/${i}`, () => undefined);
  expect(x.client.acquire('https://a.test/overflow', () => undefined)).toBeUndefined();
  expect(x.wants()).toHaveLength(256);
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  await Promise.resolve();
  expect(room).toHaveBeenCalledTimes(1);
  expect(x.client.acquire('https://a.test/overflow', () => undefined)).toBeTypeOf('function');
  // Owners of one settled or pending URL are not counted against the bound.
  const owners = Array.from({ length: 600 }, () =>
    x.client.acquire('https://a.test/1', () => undefined),
  );
  expect(owners.every(Boolean)).toBe(true);
  expect(x.wants()).toHaveLength(257);
  x.client.dispose();
});
it('keeps ready pictures through hide, cancels pending requests and re-asks them with new identities', () => {
  const x = setup(),
    first = vi.fn(),
    second = vi.fn();
  x.client.acquire('https://a.test/p?a=1', first);
  x.client.acquire('https://a.test/p?a=2', second);
  const [one, two] = x.wants();
  x.reply(one!.req, { status: 'ready', retained: true });
  const ready = first.mock.lastCall?.[0];
  x.client.visible(false);
  expect(first.mock.lastCall?.[0]).toBe(ready);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toEqual([
    { t: 'avatar.close', req: two!.req },
  ]);
  x.reply(two!.req, { status: 'ready', retained: true });
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  x.client.visible(true);
  expect(x.wants().map((m) => m.url)).toEqual([one!.url, two!.url, two!.url]);
  expect(x.wants()[2]!.req).not.toBe(two!.req);
  x.reply(x.wants()[2]!.req, { status: 'ready', retained: true });
  expect(second.mock.lastCall?.[0].kind).toBe('ready');
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  x.client.dispose();
});
it('validates actual Blob bytes before making a page object URL', () => {
  const x = setup(),
    draw = vi.fn();
  x.client.acquire('https://a.test/p', draw);
  x.client.receive({
    t: 'avatar',
    req: x.wants()[0]!.req,
    result: { status: 'ready', retained: true },
    blob: new Blob(['original'], { type: 'image/png' }),
    image: { edge: 160, sourceWidth: 800, sourceHeight: 600, bytes: 999, mime: 'image/png' },
  });
  expect(draw.mock.lastCall?.[0]).toEqual({ kind: 'rejected' });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  x.client.dispose();
});

it('still delivers the ready URL to every owner when one hides the client reentrantly', () => {
  const x = setup(),
    second = vi.fn();
  x.client.acquire('https://a.test/p', (value) => {
    if (value.kind === 'ready') x.client.visible(false);
  });
  x.client.acquire('https://a.test/p', second);
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  expect(second.mock.lastCall?.[0].kind).toBe('ready');
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  x.client.dispose();
});
it('asks by place and lets a face that came on screen overtake before the old request closes', () => {
  const x = setup(),
    draw = vi.fn();
  x.client.acquire('https://a.test/screen', () => undefined);
  x.client.acquire('https://a.test/next', () => undefined, false, 1);
  const lease = x.client.acquire('https://a.test/far', draw, false, 2)!;
  expect(x.wants().map(({ url, rank }) => [url, rank])).toEqual([
    ['https://a.test/screen', undefined],
    ['https://a.test/next', 1],
    ['https://a.test/far', 2],
  ]);
  expect('rank' in x.wants()[0]!).toBe(false);
  const old = x.wants()[2]!.req;
  lease.rank(0);
  const tail = x.sent.slice(-2);
  expect(tail[0]).toEqual({ t: 'avatar.want', req: expect.any(String), url: 'https://a.test/far' });
  expect(tail[1]).toEqual({ t: 'avatar.close', req: old });
  lease.rank(2); // Moving away again never downgrades the request already made.
  expect(x.sent.slice(-2)).toEqual(tail);
  x.reply(old, { status: 'ready', retained: true });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  x.reply(x.wants()[3]!.req, { status: 'ready', retained: true });
  expect(draw.mock.lastCall?.[0].kind).toBe('ready');
  x.client.dispose();
});
