import { afterEach, expect, it } from 'vitest';
import type { ActRef, NotificationRow } from '../src/engine/protocol.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { bodySig, patchNote, renderNote } from '../src/views/note.ts';
import { renderNotification } from '../src/views/rows.ts';
import { actor, note, notification, reader, setup, targetAct } from './acts-fixture.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});

for (const newest of ['reaction', 'repost'] as const)
  for (const targeted of ['reaction', 'repost'] as const)
    it(`uses both exact language tables for ${newest} on the reader's ${targeted}`, () => {
      const { env } = setup();
      const base = notification();
      for (const lang of ['en', 'ja'] as const) {
        setLang(lang);
        const row: NotificationRow = {
          ...base,
          type: newest,
          target: { ...base.target!, act: targetAct(targeted) },
        };
        const el = renderNotification(row, env);
        const key =
          `notif.${newest}.${targeted === 'reaction' ? 'onReaction' : 'onRepost'}` as const;
        expect(el.querySelector('.nmain')?.children[1]?.textContent).toBe(
          `Alice${t('list.sep')}Bob${t(key)}`,
        );
      }
    });

it('keeps the newest custom reaction mark and the reader act chip separate from the excerpt', () => {
  const { env, open } = setup();
  const row = notification();
  const el = renderNotification(row, env);
  expect(el.querySelector('.nmark img')?.getAttribute('alt')).toBe(':otsu:');
  const excerpt = el.querySelector<HTMLButtonElement>('.excerpt')!;
  expect(excerpt.querySelector('.rchip')?.textContent).toBe('⭐');
  expect(excerpt.querySelector('.rchip button, .rchip > span')).toBeNull();
  expect(excerpt.textContent).toBe('⭐The terminal note.');
  excerpt.click();
  expect(open).toHaveBeenLastCalledWith(
    'thread',
    { id: row.target!.id },
    { split: false, background: false },
  );
});

for (const [state, key] of [
  ['loading', 'act.note.pending'],
  ['missing', 'act.note.missing'],
  ['failed', 'quote.error'],
] as const)
  it(`keeps ${state} act chains honest and opens the first actor until the note exists`, () => {
    const { env, open } = setup();
    for (const lang of ['en', 'ja'] as const) {
      setLang(lang);
      const row: NotificationRow = {
        ...notification(),
        target: undefined,
        pendingAct: { act: targetAct(), state },
      };
      const el = renderNotification(row, env);
      expect(el.querySelector('.excerpt')?.textContent).toBe(`⭐${t(key)}`);
      expect(el.querySelector('.excerpt button')).toBeNull();
      (el.querySelector('.excerpt') as HTMLElement).click();
      expect(open).toHaveBeenLastCalledWith(
        'profile',
        { pubkey: actor.pubkey, title: actor.name },
        { split: false, background: false },
      );
    }
  });

it('omits raw legacy reaction excerpts while preserving ordinary excerpt navigation', () => {
  const { env, open } = setup();
  const base = notification();
  for (const excerpt of ['+', ':otsu:']) {
    const el = renderNotification(
      {
        ...base,
        target: { id: base.target!.id, excerpt, media: 0 },
      },
      env,
    );
    expect(el.querySelector('.excerpt')).toBeNull();
  }
  const el = renderNotification(
    {
      ...base,
      target: { id: base.target!.id, excerpt: 'An ordinary note.', media: 0 },
    },
    env,
  );
  expect(el.querySelector('.excerpt')?.textContent).toBe('An ordinary note.');
  (el.querySelector('.name') as HTMLElement).click();
  expect(open).toHaveBeenLastCalledWith(
    'profile',
    { pubkey: actor.pubkey, title: actor.name },
    { split: false, background: false },
  );
});

it('draws the person act, exact named phrase and targeted act without changing note counts', () => {
  const { env, open } = setup();
  const row = note();
  const counts = structuredClone(row.counts);
  for (const lang of ['en', 'ja'] as const) {
    setLang(lang);
    const el = renderNote(row, env);
    const context = el.querySelector('.act-context')!;
    expect(context?.querySelector('.rchip')?.textContent).toBe('❤️');
    expect(context?.querySelectorAll('.i-repost')).toHaveLength(1);
    expect(context?.querySelector('.act-phrase')?.textContent).toBe(
      t('act.on.repost', { name: reader.name }),
    );
    (context.querySelector('.name') as HTMLElement).click();
    expect(open).toHaveBeenLastCalledWith(
      'profile',
      { pubkey: reader.pubkey, title: reader.name },
      { split: false, background: false },
    );
    expect(row.counts).toEqual(counts);
  }
});

it('patches a late act author without replacing the note body or losing the name focus', () => {
  const { env } = setup();
  const row = note();
  const el = renderNote(row, env);
  document.body.append(el);
  const body = el.querySelector('.content');
  const button = el.querySelector<HTMLButtonElement>('.act-context .name')!;
  expect(button).not.toBeNull();
  button.focus();
  const actOn: ActRef = { ...row.actOn!, actor: { ...reader, name: 'Reader arrived' } };
  const next = { ...row, actOn };
  expect(bodySig(next)).toBe(bodySig(row));
  patchNote(el, next, env);
  expect(el.querySelector('.content')).toBe(body);
  expect(el.querySelector('.act-context .name')?.textContent).toBe('Reader arrived');
  expect(document.activeElement).toBe(el.querySelector('.act-context .name'));
});

it('keeps an ordinary note and direct repost context unchanged when the additive fields are absent', () => {
  const { env } = setup();
  const row = {
    ...note(),
    act: undefined,
    actOn: undefined,
    repostedBy: { actors: [actor], others: 0, at: 1794000000000 },
  };
  const el = renderNote(row, env);
  expect(el.querySelector('.act-context')).toBeNull();
  expect(el.querySelector('.ctx')?.textContent).toContain(t('ctx.reposted'));
  expect(el.querySelector('.content')?.textContent).toBe('The terminal note.');
});

it('patches a repost actor without redrawing the suppressed reposted-by line or note body', () => {
  const { env } = setup();
  const base = note();
  const own: ActRef = { type: 'repost', actor };
  const row = { ...base, act: own, repostedBy: { actors: [actor], others: 0, at: base.at } };
  const el = renderNote(row, env);
  document.body.append(el);
  const body = el.querySelector('.content');
  const updatedActor = { ...actor, name: 'Alice arrived' };
  const next = {
    ...row,
    act: { ...own, actor: updatedActor },
    repostedBy: { ...row.repostedBy, actors: [updatedActor] },
  };
  expect(bodySig(next)).toBe(bodySig(row));
  patchNote(el, next, env);
  expect(el.querySelector('.content')).toBe(body);
  expect(el.querySelectorAll(':scope > .ctx')).toHaveLength(1);
  expect(el.querySelector('.act-context')).not.toBeNull();
});
