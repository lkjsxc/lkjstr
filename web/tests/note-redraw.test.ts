import { afterEach, expect, it } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { NoteRow } from '../src/engine/protocol.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { fitNote } from '../src/views/note.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});
it('restores warning, text, media and quote choices after patches and window eviction', () => {
  const w = createWorld(Date.now());
  const source = w.notes[0];
  if (!source) throw new Error('fixture');
  const base = noteRow(w, source, { me: '' });
  let row: NoteRow = {
    ...base,
    cw: 'warning',
    media: [{ type: 'image', url: 'https://example.test/picture', sensitive: true }],
    quotes: [
      {
        state: 'ok',
        id: 'quoted',
        cw: 'quote warning',
        author: base.author,
        at: base.at,
        media: [],
        segments: [{ k: 'text', text: 'quoted text' }],
      },
    ],
  };
  const env = {
    instance: 'redraw',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
  } as unknown as ViewEnv;
  const list = document.createElement('div');
  document.body.append(list);
  const rows = createRowList(list, env, false);
  rows.draw([row]);
  list.querySelector<HTMLButtonElement>('.cw')?.click();
  const text = list.querySelector<HTMLElement>('.content > .text');
  if (!text) throw new Error('text');
  Object.defineProperties(text, { scrollHeight: { value: 900 }, clientHeight: { value: 100 } });
  fitNote(list);
  list.querySelector<HTMLButtonElement>('.fold')?.click();
  list.querySelector<HTMLButtonElement>('.media .cw')?.click();
  list.querySelector<HTMLButtonElement>('.quote .cw')?.click();
  const assert = (): void => {
    expect(list.querySelector('.content > .text.open')).not.toBeNull();
    expect(list.querySelector('.media img')).not.toBeNull();
    expect(list.querySelector('.quote .qtext')?.textContent).toBe('quoted text');
    expect(list.querySelector('.cw')).toBeNull();
  };
  assert();
  row = { ...row, counts: { ...row.counts, replies: 9 } };
  rows.draw([row]);
  assert();
  row = { ...row, author: { ...row.author, name: 'Late name' } };
  rows.draw([row]);
  assert();
  row = {
    ...row,
    previews: [
      {
        source: 'https://example.test/story',
        url: 'https://example.test/story',
        kind: 'page',
        title: 'Late metadata',
      },
    ],
  };
  rows.draw([row]);
  assert();
  rows.draw([]);
  rows.draw([row]);
  assert();
  rows.clear();
  setLang('ja');
  rows.draw([row]);
  assert();
});

it.each([7, 30311])(
  'draws kind %i with its body, context, actions and disabled reply after updates',
  (eventKind) => {
    const w = createWorld(Date.now());
    const source = w.notes[0];
    if (!source) throw new Error('fixture');
    const base = noteRow(w, source, { me: '' });
    const env = {
      instance: 'kind-fallback',
      settings: createSettings(),
      engine: { accounts: createSignal({ accounts: [] }) },
    } as unknown as ViewEnv;
    const list = document.createElement('div');
    document.body.append(list);
    const rows = createRowList(list, env, false);
    rows.draw([base]);
    expect(list.querySelector('.acts')).not.toBeNull();
    let row: NoteRow = { ...base, eventKind, segments: [{ k: 'text', text: 'public event body' }] };
    const assert = (): void => {
      expect(list.querySelector('.content > .text')?.textContent).toBe('public event body');
      const label = eventKind === 7 ? t('kind.7') : t('kind.other', { n: eventKind });
      expect(list.querySelector(':scope > .note > .ctx')?.textContent).toBe(label);
      expect(list.querySelector('.acts')).not.toBeNull();
      expect(list.querySelector('button.act.a-reply')).toBeNull();
      expect(list.querySelector('.a-reply')).not.toBeNull();
    };
    rows.draw([row]);
    assert();
    row = {
      ...row,
      counts: { ...row.counts, replies: 8 },
      author: { ...row.author, name: 'Known now' },
    };
    rows.draw([row]);
    assert();
    setLang('ja');
    rows.clear();
    rows.draw([row]);
    assert();
  },
);
