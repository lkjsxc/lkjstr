import { afterEach, expect, it } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { renderNote } from '../src/views/note.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => setLang('en'));

it('renders quote lookup failures in the reader’s language', () => {
  const world = createWorld(Date.UTC(2026, 10, 15));
  const note = world.notes[0];
  if (!note) throw new Error('missing fixture note');
  const row = {
    ...noteRow(world, note, { me: '' }),
    quotes: [{ state: 'error' as const, id: 'failed-lookup' }],
  };
  const env = { settings: createSettings() } as ViewEnv;
  for (const [lang, text] of [
    ['en', 'The quoted note could not be loaded.'],
    ['ja', '引用されたノートを読み込めませんでした。'],
  ] as const) {
    setLang(lang);
    const el = renderNote(row, env);
    expect(el.querySelector('.quote')?.textContent).toBe(text);
    expect(el.querySelector('.quote')?.classList.contains('muted')).toBe(true);
  }
});
