import { afterEach, expect, it, vi } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import { readNoteState } from '../src/shared/note-state.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { renderNote } from '../src/views/note.ts';
import { fitNote } from '../src/views/note-fold.ts';
import type { ViewEnv } from '../src/views/registry.ts';

const env = (open = vi.fn()) =>
  ({
    instance: 'generic-test',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
    open,
  }) as unknown as ViewEnv;
const fixture = (kind: number, alt: string) => {
  const world = createWorld(Date.now());
  const source = world.notes.find((n) => n.eventKind === kind && n.face?.alt === alt);
  if (!source) throw new Error('generic fixture not found');
  return noteRow(world, source, { me: '' });
};
afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

it('keeps generic details folded by default; persists expanded state and typed navigation after redraw', () => {
  const open = vi.fn();
  const view = env(open);
  const row = fixture(30311, 'Afternoon Nostr Meetup');
  const element = renderNote(row, view);
  document.body.append(element);
  expect(element.querySelector('.generic-alt')?.textContent).toBe('Afternoon Nostr Meetup');
  expect(element.querySelector('.generic-tags')?.hasAttribute('hidden')).toBe(true);
  expect(element.querySelector('button.a-reply')).toBeNull();
  expect(element.querySelector('button.a-repost')).not.toBeNull();
  element.querySelector<HTMLButtonElement>('.generic-disclosure')?.click();
  expect(element.querySelector('.generic-tags')?.hasAttribute('hidden')).toBe(false);
  expect(readNoteState('generic-test', row.id).genericDetails).toBe(true);
  const topic = [...element.querySelectorAll<HTMLButtonElement>('.generic-tag button')].find(
    (button) => button.textContent === 'nostr',
  );
  topic?.click();
  expect(open).toHaveBeenCalledWith('hashtag', { tag: 'nostr' });
  const redrawn = renderNote({ ...row, counts: { ...row.counts, reactions: 12 } }, view);
  document.body.replaceChildren(redrawn);
  expect(redrawn.querySelector('.generic-tags')?.hasAttribute('hidden')).toBe(false);
});

it('labels machine data without spilling and reuses normal Show more state', () => {
  const row = fixture(30311, 'Relay availability data');
  const element = renderNote(row, env());
  document.body.append(element);
  const text = element.querySelector<HTMLElement>('.generic-data');
  if (!text) throw new Error('machine data element');
  expect(text.textContent).toContain('relay.example.org');
  const style = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    lineHeight: '18px',
    getPropertyValue: () => '3',
  } as unknown as CSSStyleDeclaration);
  const geometry = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 320, 500));
  fitNote(element);
  style.mockRestore();
  geometry.mockRestore();
  element.querySelector<HTMLButtonElement>('.fold')?.click();
  expect(text.classList.contains('open')).toBe(true);
  expect(readNoteState('generic-test', row.id).unfolded).toBe(true);
});

it('applies the content-warning boundary before the generic face is mounted', () => {
  const row = { ...fixture(30311, 'Afternoon Nostr Meetup'), cw: 'Sensitive title' };
  const element = renderNote(row, env());
  document.body.append(element);
  expect(element.querySelector('.generic-face')).toBeNull();
  element.querySelector<HTMLButtonElement>('.cw')?.click();
  expect(element.querySelector('.generic-face')).not.toBeNull();
});
