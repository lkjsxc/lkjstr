import { afterEach, expect, it } from 'vitest';
import { avatar } from '../src/views/avatars.ts';
import {
  avatarFixture,
  avatarIntersection,
  resetAvatarFixtures,
  settleAvatars,
} from './avatar-support.ts';

afterEach(resetAvatarFixtures);

it('admits visible faces before at most 32 nearby faces and excludes detached candidates', async () => {
  const x = avatarFixture();
  for (let index = 0; index < 40; index++) {
    const face = x.face(x.author(`https://a.test/warm-${index}`));
    face.dataset.y = String(innerHeight + 10);
  }
  avatar(x.author('https://a.test/detached-candidate'));
  x.face(x.author('https://a.test/visible-last'));
  await settleAvatars();
  expect(x.wants()).toHaveLength(33);
  expect(x.wants()[0]!.url).toBe('https://a.test/visible-last');
  expect(x.wants().some((want) => want.url.includes('detached'))).toBe(false);
});

it('keeps existing nearby owners when another nearby face is inserted at the limit', async () => {
  const x = avatarFixture();
  for (let index = 0; index < 32; index++) {
    const face = x.face(x.author(`https://a.test/retained-${index}`));
    face.dataset.y = String(innerHeight + 10);
  }
  await settleAvatars();
  const next = avatar(x.author('https://a.test/new-near'));
  next.dataset.y = String(innerHeight + 10);
  x.root.prepend(next);
  await settleAvatars();
  expect(x.wants()).toHaveLength(32);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(0);
});

it('defers originals in the halo, including headers and Worker fallback results', async () => {
  const x = avatarFixture();
  const fallback = x.face(x.author('https://a.test/warm-fallback'));
  const header = x.face(x.author('https://a.test/warm-header'), 'av xl');
  fallback.dataset.y = header.dataset.y = String(innerHeight + 10);
  await settleAvatars();
  expect(x.wants()).toHaveLength(1);
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
  expect(fallback.querySelector('img')).toBeNull();
  expect(header.querySelector('img')).toBeNull();
  fallback.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(fallback, true)], {} as IntersectionObserver);
  expect(fallback.querySelector('img')?.src).toBe('https://a.test/warm-fallback');
  expect(header.querySelector('img')).toBeNull();
});

it('cancels a queued original if it leaves the viewport before obtaining a native slot', async () => {
  const x = avatarFixture();
  const faces = Array.from({ length: 7 }, (_, index) =>
    x.face(x.author(`https://a.test/queued-original-${index}`)),
  );
  await settleAvatars();
  for (const want of x.wants()) x.reply(want.req, { status: 'fallback', uniform: false });
  const first = faces[0]!.querySelector('img')!;
  const last = faces[6]!,
    queued = last.querySelector('img')!;
  expect(queued.hasAttribute('src')).toBe(false);
  last.dataset.y = '-37';
  x.intersections[0]!([avatarIntersection(last, false)], {} as IntersectionObserver);
  first.dispatchEvent(new Event('load'));
  await settleAvatars();
  expect(queued.hasAttribute('src')).toBe(false);
  expect(last.querySelector('img')).toBeNull();
  last.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(last, true)], {} as IntersectionObserver);
  expect(last.querySelector('img')?.src).toBe('https://a.test/queued-original-6');
});

it('does not bypass a deferred derived request into an original image', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'deferred', retryMs: 60_000 });
  face.dataset.y = '-37';
  x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
  face.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(face.querySelector('img')).toBeNull();
  expect(x.wants()).toHaveLength(1);
});

it('never warms a zero-height scroller or a face masked inside its scrollport', async () => {
  const x = avatarFixture(),
    scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  let height = 0;
  Object.defineProperties(scroller, {
    clientHeight: { get: () => height },
    clientWidth: { value: 300 },
    offsetHeight: { value: 300 },
    offsetWidth: { value: 300 },
  });
  const mask = document.createElement('div');
  mask.style.overflowY = 'hidden';
  Object.defineProperties(mask, {
    clientHeight: { value: 10 },
    clientWidth: { value: 300 },
    offsetHeight: { value: 300 },
    offsetWidth: { value: 300 },
  });
  const face = avatar(x.author());
  face.dataset.y = '40';
  mask.append(face);
  scroller.append(mask);
  x.root.append(scroller);
  await settleAvatars();
  expect(x.wants()).toHaveLength(0);
  height = 300;
  window.dispatchEvent(new Event('resize'));
  await new Promise(requestAnimationFrame);
  expect(x.wants()).toHaveLength(0);
  x.owner.refresh();
  await settleAvatars();
  expect(x.wants()).toHaveLength(0);
});
