import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadAvatar, publicAvatarUrl } from '../src/engine/avatar-cache.ts';
import { learnPerson } from '../src/shared/people.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { note } from './public-snapshots-support.ts';
import { vaultEnv } from './vault-ui-fixture.ts';

beforeEach(() => vi.stubGlobal('IntersectionObserver', undefined));

afterEach(async () => {
  document.body.replaceChildren();
  localStorage.clear();
  await Promise.resolve();
  await Promise.resolve();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps the initial after an image error across remounts', async () => {
  vi.useFakeTimers();
  const url = 'https://images.test/transient.png';
  const img = document.createElement('img');
  const source = vi.spyOn(img, 'src', 'set');
  document.body.append(img);
  loadAvatar(img, url);
  await vi.advanceTimersByTimeAsync(0);
  expect(source).toHaveBeenCalledExactlyOnceWith(url);
  img.dispatchEvent(new Event('error'));
  const replacement = document.createElement('img');
  const remount = vi.spyOn(replacement, 'src', 'set');
  document.body.append(replacement);
  loadAvatar(replacement, url);
  await vi.advanceTimersByTimeAsync(30000);
  expect(source).toHaveBeenCalledTimes(1);
  expect(remount).not.toHaveBeenCalled();
  expect(replacement.isConnected).toBe(false);
  expect(img.style.visibility).toBe('hidden');
});

it('lets a newly visible avatar run after stalled images release their slots', async () => {
  vi.useFakeTimers();
  let setVisible = (_target: Element, _isIntersecting: boolean) => {};
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(change: IntersectionObserverCallback) {
        setVisible = (target, isIntersecting) =>
          change([{ target, isIntersecting } as IntersectionObserverEntry], this as never);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  const face = (i: number, lazy = false) => {
    const img = document.createElement('img');
    if (lazy) img.loading = 'lazy';
    document.body.append(img);
    loadAvatar(img, `https://images.test/${i}.png`);
    return img;
  };
  const stalled = Array.from({ length: 6 }, (_, i) => face(i));
  for (const img of stalled) setVisible(img, true);
  await vi.advanceTimersByTimeAsync(0);
  expect(stalled.every((img) => img.hasAttribute('src'))).toBe(true);
  const background = face(6, true);
  const onScreen = face(7, true);
  setVisible(onScreen, true);
  await vi.advanceTimersByTimeAsync(7999);
  expect(onScreen.hasAttribute('src')).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(onScreen.getAttribute('src')).toBe('https://images.test/7.png');
  expect(stalled.every((img) => !img.hasAttribute('src'))).toBe(true);
  expect(background.hasAttribute('src')).toBe(false);
  onScreen.dispatchEvent(new Event('load'));
  setVisible(background, true);
  await vi.advanceTimersByTimeAsync(0);
  expect(background.hasAttribute('src')).toBe(true);
  background.remove();
  await vi.advanceTimersByTimeAsync(0);
  expect(background.hasAttribute('src')).toBe(true);
  document.body.append(background);
  await vi.advanceTimersByTimeAsync(0);
  setVisible(background, true);
  await vi.advanceTimersByTimeAsync(0);
  expect(background.hasAttribute('src')).toBe(true);
});

it('keeps each tile’s avatar through metadata changes and a note body redraw', async () => {
  const a = vaultEnv();
  const b = vaultEnv();
  const left = createRowList(a.el, a.env, false);
  const right = createRowList(b.el, b.env, false);
  document.body.append(a.el, b.el);
  try {
    const row = note();
    left.draw([row]);
    right.draw([row]);
    const button = a.el.querySelector<HTMLButtonElement>('.nrow > .avb')!;
    const image = button.querySelector<HTMLImageElement>('img')!;
    await vi.waitFor(() => expect(image.getAttribute('src')).toBe(row.author.picture));
    const other = b.el.querySelector('.nrow > .avb img');
    expect(other).not.toBe(image);
    expect(image.getAttribute('loading')).toBe('eager');
    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect([image.width, image.height]).toEqual([36, 36]);

    button.focus();
    const author = learnPerson({ ...row.author, name: 'Renamed', profileId: 'd'.repeat(64) });
    left.draw([{ ...row, author }]);
    expect(button.querySelector('img')).toBe(image);
    expect(b.el.querySelector('.nrow > .avb img')).toBe(other);
    expect(button.querySelector('.faceletter')?.textContent).toBe('R');
    expect(button.getAttribute('aria-label')).toBe('Renamed');
    expect(document.activeElement).toBe(button);

    const oldRow = left.node(row.key);
    left.draw([{ ...row, author, segments: [{ k: 'text', text: 'A redraw' }] }]);
    expect(left.node(row.key)).not.toBe(oldRow);
    expect(a.el.querySelector('.nrow > .avb img')).toBe(image);
    expect(image.getAttribute('src')).toBe(row.author.picture);

    learnPerson({ ...author, picture: 'https://images.test/revised.png' });
    const revised = button.querySelector<HTMLImageElement>('img')!;
    expect(revised).not.toBe(image);
    await vi.waitFor(() =>
      expect(revised.getAttribute('src')).toBe('https://images.test/revised.png'),
    );
    revised.dispatchEvent(new Event('error'));
    expect(revised.getAttribute('src')).toBeNull();
    expect(revised.style.visibility).toBe('hidden');
    expect(button.querySelector('.faceletter')?.textContent).toBe('R');
  } finally {
    left.dispose();
    right.dispose();
    a.dispose();
    b.dispose();
  }
});

it('loads the head eagerly and lets the browser schedule avatars farther down', () => {
  const f = vaultEnv();
  const rows = createRowList(f.el, f.env, false);
  try {
    rows.draw(
      Array.from({ length: 8 }, (_, i) => {
        const row = note(String(i).repeat(64));
        return { ...row, author: { ...row.author, pubkey: 'c'.repeat(64) } };
      }),
    );
    const loading = [...f.el.querySelectorAll('.nrow > .avb img')].map((img) =>
      img.getAttribute('loading'),
    );
    expect(loading).toEqual([...Array(6).fill('eager'), 'lazy', 'lazy']);
  } finally {
    rows.dispose();
    f.dispose();
  }
});

it.each([
  'https://images.test/avatar.png?token=secret',
  'https://images.test/avatar.svg#view',
  'https://user:pass@images.test/image.png',
  'http://images.test/avatar.png',
  'data:image/png;base64,AA==',
])('leaves %s on the ordinary image path', (url) => {
  expect(publicAvatarUrl(url)).toBeNull();
});
