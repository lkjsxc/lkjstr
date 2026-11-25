import { afterEach, expect, it } from 'vitest';
import { publicAvatarUrl } from '../src/engine/avatar-cache.ts';
import { learnPerson } from '../src/shared/people.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { note } from './public-snapshots-support.ts';
import { vaultEnv } from './vault-ui-fixture.ts';

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

it('keeps each tile’s avatar through metadata changes and a note body redraw', () => {
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
    expect(revised.getAttribute('src')).toBe('https://images.test/revised.png');
    revised.dispatchEvent(new Event('error'));
    expect(button.querySelector('img')).toBeNull();
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
    rows.draw(Array.from({ length: 8 }, (_, i) => note(String(i).repeat(64))));
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
