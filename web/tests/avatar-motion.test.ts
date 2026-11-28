import { afterEach, expect, it, vi } from 'vitest';
import { loadAvatar } from '../src/engine/avatar-cache.ts';
import {
  avatarFixture,
  avatarIntersection,
  resetAvatarFixtures,
  settleAvatars,
} from './avatar-support.ts';

afterEach(resetAvatarFixtures);

it('freezes an existing native image without a new offscreen original and holds its canvas until unfreeze loads', async () => {
  const x = avatarFixture(),
    made = vi.spyOn(document, 'createElement'),
    drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const face = x.face(x.author('https://a.test/motion-halo'));
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
  const image = face.querySelector('img')!;
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 80 },
    naturalHeight: { value: 60 },
  });
  image.dispatchEvent(new Event('load'));
  const images = () =>
    made.mock.results.filter((result) => result.value instanceof HTMLImageElement);
  face.dataset.y = '-37';
  x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
  x.motion(true);
  const canvas = face.querySelector('canvas');
  expect(canvas).not.toBeNull();
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(images()).toHaveLength(1);
  expect(face.querySelector('img')).toBeNull();
  x.motion(false);
  expect(images()).toHaveLength(1);
  expect(face.querySelector('canvas')).toBe(canvas);
  face.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  const resumed = face.querySelector('img')!;
  expect(resumed).not.toBe(image);
  expect(face.querySelector('canvas')).toBe(canvas);
  resumed.dispatchEvent(new Event('load'));
  expect(face.querySelector('canvas')).toBeNull();
  expect(resumed.style.visibility).toBe('');
  expect(x.wants()).toHaveLength(1);
});

it('changes an already-started native image to a freeze without restarting its load', async () => {
  const x = avatarFixture(),
    made = vi.spyOn(document, 'createElement'),
    drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const face = x.face(x.author('https://a.test/motion-loading'));
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
  const image = face.querySelector('img')!;
  x.motion(true);
  expect(
    made.mock.results.filter((result) => result.value instanceof HTMLImageElement),
  ).toHaveLength(1);
  expect(face.querySelector('img')).toBeNull();
  Object.defineProperties(image, { naturalWidth: { value: 80 }, naturalHeight: { value: 60 } });
  image.dispatchEvent(new Event('load'));
  expect(face.querySelector('canvas')).not.toBeNull();
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(x.wants()).toHaveLength(1);
});

it('keeps a failed derived image terminal across geometry and owner refreshes', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const image = face.querySelector('img')!;
  image.dispatchEvent(new Event('error'));
  expect(face.querySelector('img')).toBeNull();
  x.owner.refresh();
  await settleAvatars();
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(face.querySelector('img')).toBeNull();
  expect(x.wants()).toHaveLength(1);
});

it('keeps the canvas and cancels superseded unfreezes across motion changes in the halo', async () => {
  const x = avatarFixture(),
    made = vi.spyOn(document, 'createElement');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  x.motion(true);
  const face = x.face(x.author('https://a.test/queued-unfreeze'));
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
  const source = made.mock.results
    .map((r) => r.value)
    .find((node): node is HTMLImageElement => node instanceof HTMLImageElement)!;
  Object.defineProperties(source, { naturalWidth: { value: 80 }, naturalHeight: { value: 60 } });
  source.dispatchEvent(new Event('load'));
  const canvas = face.querySelector('canvas');
  const releases = Array.from({ length: 6 }, (_, index) =>
    loadAvatar(document.createElement('img'), `https://a.test/occupied-${index}`, false, true),
  );
  let superseded!: HTMLImageElement;
  try {
    x.motion(false);
    superseded = face.querySelector('img')!;
    expect(superseded.hasAttribute('src')).toBe(false);
    x.motion(true);
    x.motion(false);
    expect(face.querySelector('img')).not.toBe(superseded);
    expect(face.querySelector('img')!.hasAttribute('src')).toBe(false);
    face.dataset.y = '-37';
    x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
    expect(face.querySelector('img')).toBeNull();
    expect(face.querySelector('canvas')).toBe(canvas);
    x.owner.dispose();
  } finally {
    for (const release of releases) release();
  }
  await settleAvatars();
  expect(superseded.hasAttribute('src')).toBe(false);
});

it.each(['queued', 'in-flight'] as const)(
  'releases a %s unfreeze when reduced motion returns to the existing canvas',
  async (state) => {
    const x = avatarFixture(),
      made = vi.spyOn(document, 'createElement'),
      drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    x.motion(true);
    const face = x.face(x.author(`https://a.test/superseded-${state}`));
    await settleAvatars();
    x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
    const source = made.mock.results
      .map((r) => r.value)
      .find((node): node is HTMLImageElement => node instanceof HTMLImageElement)!;
    Object.defineProperties(source, { naturalWidth: { value: 80 }, naturalHeight: { value: 60 } });
    source.dispatchEvent(new Event('load'));
    const canvas = face.querySelector('canvas');
    expect(canvas).not.toBeNull();
    await settleAvatars();
    const occupied = Array.from({ length: state === 'queued' ? 6 : 5 }, () =>
      document.createElement('img'),
    );
    const releases = occupied.map((img, index) =>
      loadAvatar(img, `https://a.test/superseded-${state}-occupied-${index}`, false, true),
    );
    try {
      expect(occupied.every((img) => img.hasAttribute('src'))).toBe(true);
      x.motion(false);
      const superseded = face.querySelector('img')!;
      expect(superseded.hasAttribute('src')).toBe(state === 'in-flight');
      expect(face.querySelector('canvas')).toBe(canvas);
      x.motion(true);
      expect(face.querySelector('img')).toBeNull();
      expect(face.querySelector('canvas')).toBe(canvas);
      expect(superseded.hasAttribute('src')).toBe(false);
      for (const release of releases.splice(0)) release();
      await settleAvatars();
      // Stay mounted and reduced: another toggle or disposal would hide a leaked candidate.
      expect(superseded.hasAttribute('src')).toBe(false);
      expect(face.querySelector('canvas')).toBe(canvas);
      Object.defineProperties(superseded, {
        naturalWidth: { value: 80 },
        naturalHeight: { value: 60 },
      });
      superseded.dispatchEvent(new Event('load'));
      expect(face.querySelector('canvas')).toBe(canvas);
      expect(drawImage).toHaveBeenCalledTimes(1);
      expect(x.wants()).toHaveLength(1);
      // Returning to full motion must not be blocked by stale shown state.
      x.motion(false);
      const resumed = face.querySelector('img')!;
      expect(resumed).not.toBeNull();
      expect(resumed).not.toBe(superseded);
      expect(resumed.hasAttribute('src')).toBe(true);
      resumed.dispatchEvent(new Event('load'));
      expect(face.querySelector('canvas')).toBeNull();
    } finally {
      x.owner.dispose();
      for (const release of releases) release();
    }
  },
);
