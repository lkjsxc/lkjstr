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
it('shares one exact-URL request and object URL, revoking only after its last owner', () => {
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
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(0);
  x.client.dispose();
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
it('bounds live URL and owner records and announces newly available room', async () => {
  const x = setup(),
    room = vi.fn();
  x.client.onCapacity(room);
  const close = Array.from(
    { length: 256 },
    (_, i) => x.client.acquire(`https://a.test/${i}`, () => undefined)!,
  );
  expect(x.client.acquire('https://a.test/overflow', () => undefined)).toBeUndefined();
  close[0]!();
  await Promise.resolve();
  expect(room).toHaveBeenCalledTimes(1);
  expect(x.client.acquire('https://a.test/overflow', () => undefined)).toBeTypeOf('function');
  const owners = Array.from({ length: 256 }, () =>
    x.client.acquire('https://a.test/1', () => undefined),
  );
  expect(owners.every(Boolean)).toBe(true);
  expect(x.client.acquire('https://a.test/1', () => undefined)).toBeUndefined();
  expect(x.wants()).toHaveLength(257);
  x.client.dispose();
});
it('hides pending and ready faces, rejects late Blobs, and resumes with new request identities', () => {
  const x = setup(),
    first = vi.fn(),
    second = vi.fn();
  const a = x.client.acquire('https://a.test/p?a=1', first)!;
  const b = x.client.acquire('https://a.test/p?a=2', second)!;
  const [one, two] = x.wants();
  x.reply(one!.req, { status: 'ready', retained: true });
  x.client.visible(false);
  expect(first.mock.lastCall?.[0]).toEqual({ kind: 'pending' });
  expect(x.sent).toContainEqual({ t: 'avatar.close', req: two!.req });
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  x.reply(two!.req, { status: 'ready', retained: true });
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  x.client.visible(true);
  expect(x.wants()).toHaveLength(4);
  expect(new Set(x.wants().map((m) => m.req)).size).toBe(4);
  a();
  b();
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

it('does not deliver a revoked ready URL after an owner hides the client reentrantly', () => {
  const x = setup(),
    second = vi.fn();
  x.client.acquire('https://a.test/p', (value) => {
    if (value.kind === 'ready') x.client.visible(false);
  });
  x.client.acquire('https://a.test/p', second);
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  expect(second.mock.calls.every(([value]) => value.kind === 'pending')).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  x.client.dispose();
});
it('keeps two synchronous resumed cache-hit URLs when a pending callback resumes during hide', () => {
  const sent: ToEngine[] = [],
    second = vi.fn(),
    third = vi.fn();
  let instant = false,
    resume = false;
  let client!: ReturnType<typeof createAvatarClient>;
  const reply = (req: string): void => {
    const blob = new Blob(['still'], { type: 'image/webp' });
    client.receive({
      t: 'avatar',
      req,
      result: { status: 'ready', retained: true },
      blob,
      image: { edge: 1, sourceWidth: 1, sourceHeight: 1, bytes: blob.size, mime: blob.type },
    });
  };
  client = createAvatarClient({
    post(message) {
      sent.push(message);
      if (instant && message.t === 'avatar.want') reply(message.req);
    },
    listen() {},
    close() {},
  });
  client.acquire('https://a.test/p', (value) => {
    if (resume && value.kind === 'pending') {
      resume = false;
      client.visible(true);
    }
  });
  client.acquire('https://a.test/p', second);
  client.acquire('https://a.test/other', third);
  for (const message of sent.filter((m) => m.t === 'avatar.want')) reply(message.req);
  const old = second.mock.lastCall![0].url,
    oldOther = third.mock.lastCall![0].url;
  instant = resume = true;
  client.visible(false);
  const current = second.mock.lastCall![0];
  expect(current.kind).toBe('ready');
  expect(current.url).not.toBe(old);
  const currentOther = third.mock.lastCall![0];
  expect(currentOther.kind).toBe('ready');
  expect(currentOther.url).not.toBe(oldOther);
  expect(vi.mocked(URL.revokeObjectURL).mock.calls.map(([url]) => url)).toEqual([old, oldOther]);
  client.dispose();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
  expect(URL.revokeObjectURL).toHaveBeenLastCalledWith(currentOther.url);
});
