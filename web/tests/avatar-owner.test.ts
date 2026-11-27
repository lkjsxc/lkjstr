import { afterEach, expect, it, vi } from 'vitest';
import { learnPerson } from '../src/shared/people.ts';
import { avatar } from '../src/views/avatars.ts';
import { reconcile } from '../src/views/lists.ts';
import {
  avatarFixture,
  avatarIntersection,
  resetAvatarFixtures,
  settleAvatars,
} from './avatar-support.ts';

afterEach(resetAvatarFixtures);
it('owns only mounted visible faces and cancels a hidden retained subtree', async () => {
  const x = avatarFixture(),
    unused = avatar(x.author('https://a.test/unused'));
  expect(unused.querySelector('img')).toBeNull();
  const visible = x.face(),
    hidden = document.createElement('div');
  hidden.hidden = true;
  hidden.append(avatar(x.author('https://a.test/hidden')));
  x.root.append(hidden);
  const outside = x.face(x.author('https://a.test/offscreen'));
  outside.dataset.x = '5000';
  await settleAvatars();
  expect(x.wants().map((m) => m.url)).toEqual(['https://a.test/p']);
  visible.hidden = true;
  await settleAvatars();
  expect(x.sent).toContainEqual({ t: 'avatar.close', req: x.wants()[0]!.req });
  visible.hidden = false;
  hidden.hidden = false;
  await settleAvatars();
  expect(x.wants().map((m) => m.url)).toEqual([
    'https://a.test/p',
    'https://a.test/p',
    'https://a.test/hidden',
  ]);
  x.owner.dispose();
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(3);
});
it('keeps the object URL through complete same-URL node replacement and a temporary root move', async () => {
  const x = avatarFixture(),
    a = x.author(),
    first = x.face(a);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const source = first.querySelector('img')!.src;
  const next = avatar({ ...a, pubkey: 'f'.repeat(64), name: 'Bea' });
  x.root.replaceChildren(next);
  await settleAvatars();
  expect(x.wants()).toHaveLength(1);
  expect(x.created).toHaveBeenCalledTimes(1);
  expect(x.revoked).not.toHaveBeenCalled();
  expect(next.querySelector('img')!.src).toBe(source);
  const fragment = document.createDocumentFragment();
  fragment.append(next);
  x.root.append(next);
  await settleAvatars();
  expect(x.wants()).toHaveLength(1);
  expect(x.revoked).not.toHaveBeenCalled();
  next.remove();
  await settleAvatars();
  expect(x.revoked).toHaveBeenCalledTimes(1);
});
it('preserves image identity on profile/name updates and changes work only for a changed URL', async () => {
  const x = avatarFixture(),
    a = { ...x.author(), profileId: 'first' };
  learnPerson(a);
  const face = x.face(a);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const image = face.querySelector('img');
  learnPerson({ ...a, name: 'Bea', profileId: 'second' });
  expect(face.querySelector('img')).toBe(image);
  expect(face.querySelector('.faceletter')?.textContent).toBe('B');
  expect(x.wants()).toHaveLength(1);
  learnPerson({ ...a, name: 'Bea', picture: 'https://a.test/changed', profileId: 'third' });
  expect(x.wants().at(-1)?.url).toBe('https://a.test/changed');
  expect(x.revoked).toHaveBeenCalledTimes(1);
});
it('carries a changed channel picture onto a retained face during keyed row reconciliation', async () => {
  const x = avatarFixture(),
    a = x.author(),
    cache = new Map();
  const render = (row: { key: string; picture: string }) => {
    const el = document.createElement('div');
    el.append(avatar({ ...a, picture: row.picture }));
    return el;
  };
  reconcile(x.root, cache, [{ key: 'channel', picture: 'https://a.test/first' }], render);
  await settleAvatars();
  const face = x.root.querySelector('[data-face]');
  const req = x.wants()[0]!.req;
  reconcile(x.root, cache, [{ key: 'channel', picture: 'https://a.test/second' }], render);
  await settleAvatars();
  expect(x.root.querySelector('[data-face]')).toBe(face);
  expect(x.wants().map((m) => m.url)).toEqual(['https://a.test/first', 'https://a.test/second']);
  expect(x.sent).toContainEqual({ t: 'avatar.close', req });
  x.reply(req, { status: 'ready', retained: true });
  expect(x.created).not.toHaveBeenCalled();
});
it('releases BFCache/page-hide ownership and rejects old observer callbacks after return', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  const oldObserver = x.intersections[0]!;
  const event = new Event('pagehide');
  Object.defineProperty(event, 'persisted', { value: true });
  window.dispatchEvent(event);
  expect(x.sent).toContainEqual({ t: 'avatar.close', req: x.wants()[0]!.req });
  window.dispatchEvent(new Event('pageshow'));
  await settleAvatars();
  expect(x.wants()).toHaveLength(2);
  oldObserver([avatarIntersection(face, false)], {} as IntersectionObserver);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(1);
  x.owner.dispose();
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(2);
});
it('uses zero original images for a reduced-motion uniform result and a single blit for other fallbacks', async () => {
  const x = avatarFixture();
  x.motion(true);
  const images = vi.spyOn(document, 'createElement');
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  const uniform = x.face(x.author('https://a.test/uniform'));
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: true });
  expect(images.mock.calls.some(([tag]) => tag === 'img')).toBe(false);
  expect(uniform.querySelector('canvas')).toBeNull();
  const other = x.face(x.author('https://a.test/non-cors'));
  await settleAvatars();
  x.reply(x.wants()[1]!.req, { status: 'fallback', uniform: false });
  const made = images.mock.results
    .map((r) => r.value)
    .filter((node) => node instanceof HTMLImageElement);
  expect(made).toHaveLength(1);
  expect(other.querySelector('img')).toBeNull();
  const image = made[0] as HTMLImageElement;
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  image.dispatchEvent(new Event('load'));
  image.dispatchEvent(new Event('load'));
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(other.querySelector('canvas')).not.toBeNull();
  other.remove();
  await settleAvatars();
  expect(other.querySelector('canvas')).toBeNull();
});
it('keeps the large header original in ordinary motion and uses the still path under reduced motion', async () => {
  const x = avatarFixture(),
    header = x.face(x.author(), 'av xl');
  await settleAvatars();
  expect(x.wants()).toHaveLength(0);
  expect(header.querySelector('img')?.src).toBe('https://a.test/p');
  x.motion(true);
  expect(header.querySelector('img')).toBeNull();
  expect(x.wants()).toHaveLength(1);
});

it('ignores stale positive and negative IO geometry after newer hidden-state scans', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  const observe = x.intersections[0]!;
  face.hidden = true;
  await settleAvatars();
  observe([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(x.wants()).toHaveLength(1);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(1);
  face.hidden = false;
  await settleAvatars();
  observe([avatarIntersection(face, false)], {} as IntersectionObserver);
  expect(x.wants()).toHaveLength(2);
  expect(x.sent.filter((m) => m.t === 'avatar.close')).toHaveLength(1);
});
it('keeps the original-image fallback for a uniform result in ordinary motion', async () => {
  const x = avatarFixture(),
    face = x.face();
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: true });
  expect(face.querySelector('img')?.src).toBe('https://a.test/p');
  expect(x.created).not.toHaveBeenCalled();
});

it('excludes the border and scrollbar area of an overflowing ancestor from visibility', async () => {
  const x = avatarFixture(),
    scroller = document.createElement('div');
  scroller.style.overflowX = scroller.style.overflowY = 'auto';
  Object.defineProperties(scroller, {
    clientLeft: { value: 40 },
    clientTop: { value: 0 },
    clientWidth: { value: 260 },
    clientHeight: { value: 300 },
    offsetWidth: { value: 300 },
    offsetHeight: { value: 300 },
  });
  x.root.append(scroller);
  const face = avatar(x.author());
  scroller.append(face);
  await settleAvatars();
  expect(x.wants()).toHaveLength(0);
  face.dataset.x = '70';
  x.intersections[0]!([avatarIntersection(face, true)], {} as IntersectionObserver);
  expect(x.wants()).toHaveLength(1);
  face.dataset.x = '20';
  x.intersections[0]!([avatarIntersection(face, false)], {} as IntersectionObserver);
  expect(x.sent).toContainEqual({ t: 'avatar.close', req: x.wants()[0]!.req });
});

it.each([
  ['https://a.test/trailing \t', 'https://a.test/trailing'],
  [' \thttps://a.test/leading ', 'https://a.test/leading'],
  ['https://a.test/in ternal', 'https://a.test/in%20ternal'],
  ['https://a.test/con\ttrol', 'https://a.test/control'],
  ['https://A.test:443/%7e?q=%2f#tag', 'https://A.test:443/%7e?q=%2f#tag'],
])('uses a safe lease URL for %j without normalizing clean identity', async (picture, expected) => {
  const x = avatarFixture();
  x.face(x.author(picture));
  await settleAvatars();
  expect(x.wants().map((m) => m.url)).toEqual([expected]);
});

it.each([true, false])(
  'releases a frozen source after shared load listeners, drawable=%s',
  async (drawable) => {
    const x = avatarFixture();
    x.motion(true);
    const images = vi.spyOn(document, 'createElement');
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      drawable ? ({ drawImage } as unknown as CanvasRenderingContext2D) : null,
    );
    const url = 'https://a.test/shared-freeze';
    const first = x.face(x.author(url));
    const second = x.face(x.author(url));
    await settleAvatars();
    x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
    const made = images.mock.results
      .map((r) => r.value)
      .filter((node): node is HTMLImageElement => node instanceof HTMLImageElement);
    expect(made).toHaveLength(2);
    const [owner, waiter] = made as [HTMLImageElement, HTMLImageElement];
    expect(owner.getAttribute('src')).toBe(url);
    expect(waiter.hasAttribute('src')).toBe(false);
    const removeSource = vi.spyOn(owner, 'removeAttribute');
    Object.defineProperties(owner, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
    owner.dispatchEvent(new Event('load'));
    expect(owner.getAttribute('src')).toBe(url);
    expect(waiter.getAttribute('src')).toBe(url);
    expect(drawImage).toHaveBeenCalledTimes(drawable ? 1 : 0);
    expect(!!first.querySelector('canvas')).toBe(drawable);
    expect(second.querySelector('canvas')).toBeNull();
    await settleAvatars();
    expect(owner.hasAttribute('src')).toBe(false);
    expect(removeSource.mock.calls.filter(([name]) => name === 'src')).toHaveLength(1);
    x.owner.dispose();
    // Disposal no longer holds or invokes the completed native image release.
    expect(removeSource.mock.calls.filter(([name]) => name === 'src')).toHaveLength(1);
  },
);
