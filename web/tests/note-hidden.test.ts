import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { readNoteState } from '../src/shared/note-state.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { renderNote } from '../src/views/note.ts';
import type { ViewEnv } from '../src/views/registry.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});
const row = (extra: Partial<NoteRow>): NoteRow =>
  ({
    kind: 'note',
    id: 'n1',
    key: 'n1',
    at: Date.UTC(2026, 10, 21),
    author: { pubkey: 'a'.repeat(64), name: 'Secret Name' },
    segments: [{ k: 'text', text: 'the hidden body' }],
    media: [],
    quotes: [],
    counts: { replies: 0, reposts: 0, reactions: 0, zaps: 0 },
    reactions: [],
    mine: { reposted: false, reacted: null, own: false },
    ...extra,
  }) as unknown as NoteRow;
const envOf = () => {
  const reveal = vi.fn(async () => true);
  const open = vi.fn();
  const env = {
    instance: 'hid',
    settings: createSettings(),
    engine: {
      reveal,
      info: { get: () => ({ version: 15 }) },
      me: () => '',
      accounts: createSignal({ accounts: [] }),
    },
    open,
  } as unknown as ViewEnv;
  return { env, reveal, open };
};

describe('a hidden note', () => {
  it('holds its slot with one line: the reason, Why and Show, and nothing of the note', () => {
    const { env } = envOf();
    const el = renderNote(
      row({ hidden: { reason: 'muted-person', revealable: true } }),
      env,
      false,
    );
    expect(el.classList.contains('hid')).toBe(true);
    expect(el.hasAttribute('data-pass')).toBe(true);
    expect(el.textContent).toBe('From someone you muted.WhyShow');
    expect(el.textContent).not.toContain('Secret Name');
    expect(el.querySelector('.av, img, .text')).toBeNull();
  });
  it('says why inline and opens the reason’s own setting', () => {
    const { env, open } = envOf();
    const el = renderNote(row({ hidden: { reason: 'muted-word', detail: 'spoiler' } }), env, false);
    const why = el.querySelector<HTMLButtonElement>('.hline button');
    why?.click();
    expect(why?.getAttribute('aria-expanded')).toBe('true');
    const detail = el.querySelector<HTMLElement>('.hwhy');
    expect(detail?.hidden).toBe(false);
    expect(detail?.textContent).toContain('“spoiler”, one of your muted words.');
    detail?.querySelector<HTMLButtonElement>('button')?.click();
    expect(open).toHaveBeenCalledWith('settings', { at: 'set.mute.word' });
    why?.click();
    expect(detail?.hidden).toBe(true);
  });
  it('leads repeats and floods to the visitor setting, and offers no switch for machine data', () => {
    const { env, open } = envOf();
    const flood = renderNote(row({ hidden: { reason: 'author-limit' } }), env, false);
    flood.querySelector<HTMLButtonElement>('.hline button')?.click();
    flood.querySelector<HTMLButtonElement>('.hwhy button')?.click();
    expect(open).toHaveBeenCalledWith('settings', { at: 'visitorFilter' });
    const data = renderNote(row({ hidden: { reason: 'machine-payload' } }), env, false);
    data.querySelector<HTMLButtonElement>('.hline button')?.click();
    expect(data.querySelector('.hwhy button')).toBeNull();
  });
  it('never offers Show for a deleted or expired note, or one the engine cannot show', () => {
    const { env } = envOf();
    for (const hidden of [
      { reason: 'deleted' },
      { reason: 'expired' },
      { reason: 'muted-thread', revealable: false },
    ]) {
      const el = renderNote(row({ hidden }), env, false);
      expect([...el.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Why']);
    }
  });
  it('asks the engine to show it, remembers that, and asks again when the row comes back', async () => {
    const { env, reveal } = envOf();
    const el = renderNote(row({ hidden: { reason: 'language', revealable: true } }), env, false);
    document.body.append(el);
    [...el.querySelectorAll('button')].find((b) => b.textContent === 'Show')?.click();
    expect(reveal).toHaveBeenCalledWith(el, 'n1', true);
    await Promise.resolve();
    expect(readNoteState('hid', 'n1').shown).toBe(true);
    const again = renderNote(
      row({ hidden: { reason: 'language', revealable: true }, id: 'n1' }),
      env,
      false,
    );
    document.body.append(again);
    await new Promise((r) => requestAnimationFrame(r));
    expect(reveal).toHaveBeenLastCalledWith(again, 'n1', true);
  });
  it('shown, says why it was hidden above the note, and Hide puts the line back', () => {
    const { env, reveal } = envOf();
    const el = renderNote(row({ revealed: { reason: 'muted-person' } }), env, false);
    const line = el.querySelector('.ctx.hshown');
    expect(line?.textContent).toBe('Shown. From someone you muted.Hide');
    expect(el.textContent).toContain('the hidden body');
    line?.querySelector<HTMLButtonElement>('button')?.click();
    expect(reveal).toHaveBeenCalledWith(el, 'n1', false);
    expect(readNoteState('hid', 'n1').shown).toBe(false);
  });
  it('says an unknown reason plainly', () => {
    const { env } = envOf();
    setLang('ja');
    const el = renderNote(
      row({ hidden: { reason: 'something-new', revealable: true } }),
      env,
      false,
    );
    expect(el.querySelector('.hline span')?.textContent).toBe('非表示です。');
  });
});

describe('a content warning', () => {
  it('keeps the row and folds only its body, drawing nothing behind it before Show', () => {
    const { env } = envOf();
    const media = [{ type: 'image', url: 'https://example.test/p.png', sensitive: true }];
    const el = renderNote(row({ cw: 'spoilers', media } as Partial<NoteRow>), env, false);
    expect(el.querySelector('.nhead')).not.toBeNull();
    expect(el.querySelector('.acts')).not.toBeNull();
    expect(el.querySelector('.content, img')).toBeNull();
    expect(el.querySelector('.cw')?.textContent).toBe('Content warning: spoilersShow');
    el.querySelector<HTMLButtonElement>('.cw')?.click();
    expect(el.querySelector('.content .text')?.textContent).toBe('the hidden body');
    const line = el.querySelector('.cwline');
    expect(line?.textContent).toBe('Content warning: spoilersHide');
    expect(readNoteState('hid', 'n1').warning).toBe(true);
    line?.querySelector<HTMLButtonElement>('button')?.click();
    expect(el.querySelector('.content, .cwline')).toBeNull();
    expect(el.querySelector('.cw')).not.toBeNull();
    expect(readNoteState('hid', 'n1').warning).toBe(false);
  });
});
