import { afterEach, expect, it } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { Counts, NoteRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import { actionRow } from '../src/views/note-actions.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => setLang('en'));

it('only unresolved zap totals reuse the existing lower-bound suffix', () => {
  const world = createWorld(Date.UTC(2026, 10, 16));
  const note = world.notes[0];
  if (!note) throw new Error('missing fixture note');
  const base = noteRow(world, note, { me: '' });
  const env = { engine: { accounts: createSignal({ accounts: [] }) } } as unknown as ViewEnv;
  const draw = (counts: Partial<Counts>): HTMLElement => {
    const row: NoteRow = {
      ...base,
      counts: { ...base.counts, replies: 3, partial: false, zaps: 21, ...counts },
    };
    const actions = actionRow(row, env);
    if (!actions) throw new Error('ordinary note actions must remain available');
    return actions;
  };
  for (const lang of ['en', 'ja'] as const) {
    setLang(lang);
    for (const zapState of ['loading', 'failed', 'unsupported'] as const) {
      const el = draw({ zapState, zapUnverified: 1 });
      expect(el.querySelector('.a-zap span')?.textContent).toBe('21+');
      expect(el.querySelector('.a-reply span')?.textContent).toBe('3');
    }
    expect(draw({ zapState: 'ready' }).querySelector('.a-zap span')?.textContent).toBe('21');
    expect(draw({ zapState: undefined }).querySelector('.a-zap span')?.textContent).toBe('21');
    expect(
      draw({ zapState: 'ready', zapLimited: true }).querySelector('.a-zap span')?.textContent,
    ).toBe('21+');
    expect(draw({ zapState: 'loading', zaps: 0 }).querySelector('.a-zap span')?.textContent).toBe(
      '',
    );
    const capped = draw({
      zapState: 'ready',
      zapLimited: true,
      zaps: Number.MAX_SAFE_INTEGER,
      zapAmountMsat: '9016206453995731991',
    });
    expect(capped.querySelector('.a-zap span')?.textContent).toBe(
      lang === 'en' ? '9007199254M+' : '90071992億+',
    );
  }
});
