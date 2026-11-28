import { afterEach, expect, it, vi } from 'vitest';
import { loadAvatar } from '../src/engine/avatar-cache.ts';
import {
  avatarFixture,
  avatarIntersection,
  resetAvatarFixtures,
  settleAvatars,
} from './avatar-support.ts';

afterEach(() => {
  Reflect.deleteProperty(navigator, 'connection');
  Reflect.deleteProperty(document, 'visibilityState');
  resetAvatarFixtures();
});
const visibility = (state: 'hidden' | 'visible'): void => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
};

it('keeps the picture node and lease of a mounted face that scrolls far off screen', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const image = face.querySelector('img')!,
    source = image.src;
  face.dataset.y = '-9000';
  x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
  window.dispatchEvent(new Event('scroll'));
  await new Promise(requestAnimationFrame);
  expect(face.querySelector('img')).toBe(image);
  expect(image.src).toBe(source);
  face.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(face.querySelector('img')).toBe(image);
  expect(x.wants()).toHaveLength(1);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(0);
  expect(x.revoked).not.toHaveBeenCalled();
});

it('draws a returning person from the session cache in the mount microtask, without asking', async () => {
  const x = avatarFixture(),
    author = x.author('https://a.test/returning'),
    first = x.face(author);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const source = first.querySelector('img')!.src;
  first.remove();
  await settleAvatars();
  const direct = vi.fn();
  x.client.acquire('https://a.test/returning', direct)!();
  expect(direct).toHaveBeenCalledExactlyOnceWith({ kind: 'ready', url: source });
  const next = x.face(author);
  next.dataset.y = String(innerHeight * 3); // Even a row that mounts far below the screen.
  expect(next.querySelector('img')).toBeNull();
  for (let turn = 0; turn < 4; turn++) await Promise.resolve(); // Observer delivery, then the scan.
  expect(next.querySelector('img')?.src).toBe(source);
  expect(x.wants()).toHaveLength(1);
  expect(x.created).toHaveBeenCalledTimes(1);
  expect(x.revoked).not.toHaveBeenCalled();
});

it('keeps drawn faces across a tab hide and show, and re-asks only what was still pending', async () => {
  const x = avatarFixture(),
    shown = x.face(x.author('https://a.test/tab-shown')),
    waiting = x.face(x.author('https://a.test/tab-waiting'));
  await settleAvatars();
  const [first, second] = x.wants();
  x.reply(first!.req, { status: 'ready', retained: true });
  const image = shown.querySelector('img')!,
    source = image.src;
  visibility('hidden');
  x.client.visible(false);
  expect(shown.querySelector('img')).toBe(image);
  expect(x.revoked).not.toHaveBeenCalled();
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toEqual([
    { t: 'avatar.close', req: second!.req },
  ]);
  x.client.visible(true);
  visibility('visible');
  await settleAvatars();
  expect(shown.querySelector('img')).toBe(image);
  expect(image.src).toBe(source);
  expect(x.revoked).not.toHaveBeenCalled();
  expect(x.wants().map((want) => want.url)).toEqual([
    'https://a.test/tab-shown',
    'https://a.test/tab-waiting',
    'https://a.test/tab-waiting',
  ]);
  expect(x.wants()[2]!.req).not.toBe(second!.req);
  x.reply(x.wants()[2]!.req, { status: 'ready', retained: true });
  expect(waiting.querySelector('img')).not.toBeNull();
});

it('revokes every session picture on account reset', async () => {
  const x = avatarFixture(),
    kept = x.face(x.author('https://a.test/reset-owned')),
    gone = x.face(x.author('https://a.test/reset-idle'));
  await settleAvatars();
  for (const want of x.wants()) x.reply(want.req, { status: 'ready', retained: true });
  gone.remove();
  await settleAvatars();
  x.client.reset();
  expect(x.revoked).toHaveBeenCalledTimes(2);
  expect(kept.querySelector('img')).toBeNull();
  expect(x.wants().map((want) => want.url)).toEqual([
    'https://a.test/reset-owned',
    'https://a.test/reset-idle',
    'https://a.test/reset-owned',
  ]);
});

it('under data saver asks for a far mounted face only once it comes near', async () => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { saveData: true },
  });
  const x = avatarFixture();
  x.face(x.author('https://a.test/saver-screen'));
  const far = x.face(x.author('https://a.test/saver-far'));
  far.dataset.y = String(innerHeight * 2 + 1000);
  await settleAvatars();
  expect(x.wants().map((want) => want.url)).toEqual(['https://a.test/saver-screen']);
  far.dataset.y = String(innerHeight + 10);
  x.intersections[0]!([avatarIntersection(far, true)], {} as IntersectionObserver);
  expect(x.wants().map(({ url, rank }) => [url, rank])).toEqual([
    ['https://a.test/saver-screen', undefined],
    ['https://a.test/saver-far', 1],
  ]);
  x.reply(x.wants()[1]!.req, { status: 'ready', retained: true });
  const image = far.querySelector('img');
  far.dataset.y = String(innerHeight * 2 + 1000);
  x.intersections[0]!([avatarIntersection(far, false)], {} as IntersectionObserver);
  expect(far.querySelector('img')).toBe(image); // Once drawn it stays, as without data saver.
});

it('gives a second owned image a finished original at once, without the pending state', () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(80);
  const url = 'https://images.test/held-original.png';
  const first = document.createElement('img'),
    second = document.createElement('img');
  document.body.append(first, second);
  const releaseFirst = loadAvatar(first, url, false, true);
  expect(first.hasAttribute('data-avatar-pending')).toBe(true);
  expect(first.style.visibility).toBe('hidden');
  first.dispatchEvent(new Event('load'));
  expect(first.style.visibility).toBe('');
  const releaseSecond = loadAvatar(second, url, false, true);
  expect(second.getAttribute('src')).toBe(url);
  expect(second.hasAttribute('data-avatar-pending')).toBe(false);
  expect(second.style.visibility).not.toBe('hidden');
  releaseSecond();
  expect(second.hasAttribute('src')).toBe(false);
  releaseFirst();
});
