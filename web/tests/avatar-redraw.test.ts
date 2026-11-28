import { afterEach, expect, it } from 'vitest';
import { avatar } from '../src/views/avatars.ts';
import type { ListRow } from '../src/views/feed-draw.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { reconcile } from '../src/views/lists.ts';
import { avatarFixture, resetAvatarFixtures, settleAvatars } from './avatar-support.ts';
import { note } from './public-snapshots-support.ts';
import { vaultEnv } from './vault-ui-fixture.ts';

afterEach(() => {
  resetAvatarFixtures();
  localStorage.clear();
});

it.each(['person', 'profile', 'notification', 'quote'] as const)(
  'retains painted %s avatars immediately through a substantive row redraw',
  async (kind) => {
    const x = avatarFixture(),
      f = vaultEnv(),
      author = x.author();
    x.root.append(f.el);
    // The profile header is a derived still in reduced motion.
    if (kind === 'profile') x.motion(true);
    const rows = createRowList(f.el, f.env, false);
    const base = note();
    const value: ListRow =
      kind === 'person'
        ? {
            kind,
            key: 'person',
            author,
            about: 'Before',
            followed: false,
            followsYou: false,
            self: false,
          }
        : kind === 'profile'
          ? {
              kind,
              key: 'profile',
              author,
              about: [],
              partial: false,
              followed: false,
              followsYou: false,
              self: false,
              muted: false,
              relays: [],
              knownFollowers: { actors: [author], others: 0 },
            }
          : kind === 'notification'
            ? {
                kind,
                key: 'notification',
                type: 'reaction',
                actors: [author],
                others: 0,
                at: 1,
                unread: true,
              }
            : {
                ...base,
                quotes: [
                  {
                    state: 'ok',
                    id: 'b'.repeat(64),
                    author,
                    at: 1,
                    segments: [{ k: 'text', text: 'Quoted text' }],
                    media: [],
                  },
                ],
              };
    try {
      rows.draw([value]);
      await settleAvatars();
      for (const want of x.wants()) x.reply(want.req, { status: 'ready', retained: true });
      const faces = [...f.el.querySelectorAll('[data-face]')];
      const images = faces.map((face) => face.querySelector('img'));
      expect(faces.length).toBeGreaterThan(0);
      expect(images.every(Boolean)).toBe(true);
      const next: ListRow =
        value.kind === 'person'
          ? { ...value, about: 'After' }
          : value.kind === 'profile'
            ? { ...value, followers: 12 }
            : value.kind === 'notification'
              ? { ...value, others: 2 }
              : value.kind === 'note'
                ? { ...value, segments: [{ k: 'text', text: 'Changed body' }] }
                : value;
      rows.draw([next]);
      expect([...f.el.querySelectorAll('[data-face]')]).toEqual(faces);
      expect(
        [...f.el.querySelectorAll('[data-face]')].map((face) => face.querySelector('img')),
      ).toEqual(images);
    } finally {
      rows.dispose();
      f.dispose();
    }
  },
);

it('reuses each duplicate-author list face once', async () => {
  const x = avatarFixture(),
    author = x.author(),
    cache = new Map();
  const render = () => {
    const row = document.createElement('div');
    row.append(avatar(author), avatar(author));
    return row;
  };
  reconcile(x.root, cache, [{ key: 'same', revision: 1 }], render);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const faces = [...x.root.querySelectorAll('[data-face]')];
  reconcile(x.root, cache, [{ key: 'same', revision: 2 }], render);
  expect([...x.root.querySelectorAll('[data-face]')]).toEqual(faces);
});

it('matches public and private faces separately when their positions swap', async () => {
  const x = avatarFixture(),
    author = { ...x.author(), profileId: 'verified' },
    cache = new Map();
  const render = (row: { key: string; publicFirst: boolean }) => {
    const el = document.createElement('div');
    for (const cachePublic of [row.publicFirst, !row.publicFirst])
      el.append(avatar(author, 'av', { cachePublic }));
    return el;
  };
  reconcile(x.root, cache, [{ key: 'mixed', publicFirst: false }], render);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const [privateFace, publicFace] = x.root.querySelectorAll('[data-face]');
  reconcile(x.root, cache, [{ key: 'mixed', publicFirst: true }], render);
  expect([...x.root.querySelectorAll('[data-face]')]).toEqual([publicFace, privateFace]);
  expect(x.wants()).toHaveLength(1);
  expect(x.wants()[0]!.observePublic).toBeUndefined();
});

it('preserves a loaded native fallback across person-row replacement', async () => {
  const x = avatarFixture(),
    f = vaultEnv(),
    author = x.author('https://a.test/native-redraw');
  x.root.append(f.el);
  const rows = createRowList(f.el, f.env, false);
  const value = {
    kind: 'person' as const,
    key: 'native-person',
    author,
    about: 'Before',
    followed: false,
    followsYou: false,
    self: false,
  };
  try {
    rows.draw([value]);
    await settleAvatars();
    x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: false });
    const image = f.el.querySelector('img')!;
    image.dispatchEvent(new Event('load'));
    rows.draw([{ ...value, about: 'After' }]);
    expect(f.el.querySelector('img')).toBe(image);
    expect(image.style.visibility).toBe('');
    expect(x.wants()).toHaveLength(1);
  } finally {
    rows.dispose();
    f.dispose();
  }
});
