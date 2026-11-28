import { afterEach, expect, it, vi } from 'vitest';
import { avatar } from '../src/views/avatars.ts';
import {
  avatarFixture,
  avatarIntersection,
  resetAvatarFixtures,
  settleAvatars,
} from './avatar-support.ts';

afterEach(resetAvatarFixtures);

it('asks for every mounted face, ordered by place: screen, the next screen, further along', async () => {
  const x = avatarFixture();
  const far = x.face(x.author('https://a.test/far'));
  far.dataset.y = String(innerHeight * 2 + 1000);
  const near = x.face(x.author('https://a.test/near'));
  near.dataset.y = String(innerHeight + 10);
  x.face(x.author('https://a.test/screen'));
  await settleAvatars();
  expect(x.wants().map(({ url, rank }) => [url, rank])).toEqual([
    ['https://a.test/screen', undefined],
    ['https://a.test/near', 1],
    ['https://a.test/far', 2],
  ]);
  expect('rank' in x.wants()[0]!).toBe(false);
});

it.each(['ready', 'fallback'] as const)(
  'keeps a loaded %s image when scrolling just outside and back',
  async (status) => {
    const x = avatarFixture(),
      face = x.face();
    await settleAvatars();
    x.reply(
      x.wants()[0]!.req,
      status === 'ready' ? { status, retained: true } : { status, uniform: false },
    );
    const image = face.querySelector<HTMLImageElement>('img')!;
    image.dispatchEvent(new Event('load'));
    const source = image.src;
    face.dataset.y = '-37';
    x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
    expect(face.querySelector('img')).toBe(image);
    expect(image.src).toBe(source);
    expect(image.style.visibility).not.toBe('hidden');
    face.dataset.y = '20';
    x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
    expect(face.querySelector('img')).toBe(image);
    expect(x.wants()).toHaveLength(1);
    expect(x.revoked).not.toHaveBeenCalled();
  },
);

it('keeps a ready still through reduced-motion changes', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const image = face.querySelector('img');
  x.motion(true);
  expect(face.querySelector('img')).toBe(image);
  x.motion(false);
  expect(face.querySelector('img')).toBe(image);
  expect(x.wants()).toHaveLength(1);
  expect(x.revoked).not.toHaveBeenCalled();
});

it('reuses a ready URL after the previous appearance has unmounted', async () => {
  const x = avatarFixture(),
    author = x.author(),
    first = x.face(author);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const url = first.querySelector('img')!.src;
  first.remove();
  await settleAvatars();
  const next = x.face(author);
  await settleAvatars();
  expect(next.querySelector('img')?.src).toBe(url);
  expect(x.wants()).toHaveLength(1);
  expect(x.created).toHaveBeenCalledTimes(1);
});

it('requests synchronous presentation for a bounded ready still', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  expect(face.querySelector('img')?.decoding).toBe('sync');
});

it('ranks within a nested vertical scrollport and re-ranks on scroll without an IO entry', async () => {
  const x = avatarFixture(),
    scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  Object.defineProperties(scroller, {
    clientWidth: { value: 300 },
    clientHeight: { value: 300 },
    offsetWidth: { value: 300 },
    offsetHeight: { value: 300 },
  });
  const outer = document.createElement('div');
  outer.style.overflowY = 'hidden'; // The real tile's .body.own also clips the inner view.
  Object.defineProperties(outer, {
    clientWidth: { value: 300 },
    clientHeight: { value: 300 },
    offsetWidth: { value: 300 },
    offsetHeight: { value: 300 },
  });
  outer.append(scroller);
  x.root.append(outer);
  const near = avatar(x.author('https://a.test/nested-near'));
  near.dataset.y = '330';
  const next = avatar(x.author('https://a.test/nested-next'));
  next.dataset.y = String(innerHeight * 2 + 1000);
  scroller.append(near, next);
  await settleAvatars();
  expect(x.wants().map(({ url, rank }) => [url, rank])).toEqual([
    ['https://a.test/nested-near', 1],
    ['https://a.test/nested-next', 2],
  ]);
  const old = x.wants()[1]!.req;
  next.dataset.y = '350';
  scroller.dispatchEvent(new Event('scroll'));
  await vi.waitFor(() => expect(x.wants()).toHaveLength(3));
  expect(x.wants()[2]).toMatchObject({ url: 'https://a.test/nested-next', rank: 1 });
  expect(x.sent.at(-1)).toEqual({ t: 'avatar.close', req: old });
});

it('retains a frozen native canvas across a small scroll reversal', async () => {
  const x = avatarFixture();
  x.motion(true);
  const images = vi.spyOn(document, 'createElement'),
    drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const face = x.face(x.author('https://a.test/frozen-scroll'));
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
  const image = images.mock.results
    .map((r) => r.value)
    .find((node): node is HTMLImageElement => node instanceof HTMLImageElement)!;
  Object.defineProperties(image, { naturalWidth: { value: 80 }, naturalHeight: { value: 60 } });
  image.dispatchEvent(new Event('load'));
  const canvas = face.querySelector('canvas');
  expect(canvas).not.toBeNull();
  face.dataset.y = '-37';
  x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
  expect(face.querySelector('canvas')).toBe(canvas);
  face.dataset.y = '20';
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(face.querySelector('canvas')).toBe(canvas);
  expect(drawImage).toHaveBeenCalledTimes(1);
});
