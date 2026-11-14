// Every keyboard shortcut of lkjstr, in one table. The handlers ask `pressed` with an id from this table and the
// Shortcuts tab lists the same table, so what the tab says is what the keys do.

import { SPACES } from '../wm/spaces.ts';
import type { Key } from './i18n.ts';
import { keyLabel, matches } from './platform.ts';

export type KeyGroup = 'window' | 'feed' | 'compose' | 'viewer';
type Binding = {
  readonly group: KeyGroup;
  /** Any of these (`Mod` is ⌘ on Apple devices and Ctrl elsewhere; `Plus` is the + character). */
  readonly combos: readonly string[];
  /** The combos are one run (workspace 1 to 9): listed as the first and the last. */
  readonly run?: boolean;
};
const one = (group: KeyGroup, ...combos: string[]): Binding => ({ group, combos });

export const KEYS = {
  workspace: {
    group: 'window',
    combos: Array.from({ length: SPACES }, (_, i) => `Alt+Shift+${i + 1}`),
    run: true,
  },
  launcherPick: one('window', 'Enter'),
  launcherClose: one('window', 'Escape'),
  menuClose: one('window', 'Escape'),
  filter: one('feed', '/'),
  filterLeave: one('feed', 'Escape'),
  send: one('compose', 'Mod+Enter'),
  viewerClose: one('viewer', 'Escape'),
  viewerLeft: one('viewer', 'ArrowLeft'),
  viewerRight: one('viewer', 'ArrowRight'),
  viewerPrev: one('viewer', 'PageUp'),
  viewerNext: one('viewer', 'PageDown'),
  zoomIn: one('viewer', 'Plus', '='),
  zoomOut: one('viewer', '-'),
  zoomFit: one('viewer', '0'),
  play: one('viewer', ' ', 'K'),
  mute: one('viewer', 'M'),
  volumeUp: one('viewer', 'ArrowUp'),
  volumeDown: one('viewer', 'ArrowDown'),
  fullscreen: one('viewer', 'F'),
} as const satisfies Record<string, Binding>;
export type KeyId = keyof typeof KEYS;
export const KEY_GROUPS: readonly KeyGroup[] = ['window', 'feed', 'compose', 'viewer'];

/** The words for a binding and for a group: the string tables must have them (checked by the compiler). */
export const keyText = (id: KeyId): Key => `key.${id}`;
export const groupText = (group: KeyGroup): Key => `keys.${group}`;

const hit = (e: KeyboardEvent, combo: string): boolean =>
  combo === 'Plus'
    ? e.key === '+' && !e.ctrlKey && !e.metaKey && !e.altKey
    : matches(e, combo) && (combo !== '/' || e.key === '/');

/** Which of the binding's combos the event is (-1: none). Never during text composition. */
export const pressedAt = (e: KeyboardEvent, id: KeyId): number =>
  e.isComposing ? -1 : KEYS[id].combos.findIndex((c) => hit(e, c));
export const pressed = (e: KeyboardEvent, id: KeyId): boolean => pressedAt(e, id) >= 0;

const NAMES: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Plus: '+',
  ' ': 'Space',
};
/** A combo as this device prints it. */
export const comboLabel = (combo: string, apple?: boolean): string =>
  keyLabel(
    combo
      .split('+')
      .map((p) => NAMES[p] ?? p)
      .join('+'),
    apple,
  );
/** The key caps of a binding: each alternative, or the two ends of a run. */
export function keyCaps(id: KeyId, apple?: boolean): string[] {
  const b: Binding = KEYS[id];
  const caps = b.combos.map((c) => comboLabel(c, apple));
  return b.run ? [`${caps[0]} … ${(b.combos[b.combos.length - 1] ?? '').split('+').pop()}`] : caps;
}
