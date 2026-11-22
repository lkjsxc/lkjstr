// Every keyboard shortcut of lkjstr, in one table. The handlers ask `pressed` with an id from this table and the
// Shortcuts tab lists the same table, so what the tab says is what the keys do.

import { SPACES } from '../wm/spaces.ts';
import { type Key, t } from './i18n.ts';
import { keyLabel, matches } from './platform.ts';

export type KeyGroup = 'window' | 'go' | 'feed' | 'note' | 'compose' | 'viewer' | 'pointer';
type Binding = {
  readonly group: KeyGroup;
  /** Any of these (`Mod` is ⌘ on Apple devices and Ctrl elsewhere; `Plus` is the + character). */
  readonly combos: readonly string[];
  /** The combos are one run (workspace 1 to 9): listed as the first and the last. */
  readonly run?: boolean;
  /** The second key of a pair: it counts only right after this one (`G` then `H`). */
  readonly after?: string;
  /** A press that may repeat while held (moving); everything else acts once per press. */
  readonly held?: boolean;
};
const one = (group: KeyGroup, ...combos: string[]): Binding => ({ group, combos });
const held = (group: KeyGroup, ...combos: string[]): Binding => ({ group, combos, held: true });
const go = (key: string): Binding => ({ group: 'go', combos: [key], after: 'G' });

export const KEYS = {
  workspace: {
    group: 'window',
    combos: Array.from({ length: SPACES }, (_, i) => `Alt+Shift+${i + 1}`),
    run: true,
  },
  tabPrev: held('window', 'Alt+Shift+ArrowLeft'),
  tabNext: held('window', 'Alt+Shift+ArrowRight'),
  tilePrev: held('window', 'Alt+Shift+ArrowUp'),
  tileNext: held('window', 'Alt+Shift+ArrowDown'),
  tabToTile: one('window', 'Alt+Shift+Enter'),
  tabNew: one('window', 'Alt+Shift+N'),
  tabClose: one('window', 'X', 'Alt+Shift+W'),
  tabSearch: one('window', 'O'),
  tabReopen: one('window', 'Alt+Shift+T'),
  tileFill: one('window', 'Alt+Shift+F'),
  tileRestore: one('window', 'Escape'),
  launcherPick: one('window', 'Enter'),
  launcherClose: one('window', 'Escape'),
  menuClose: one('window', 'Escape'),
  goHome: go('H'),
  goNotifications: go('N'),
  goBookmarks: go('B'),
  goMessages: one('go', 'Alt+Shift+M'),
  compose: one('go', 'N'),
  help: one('go', '?'),
  back: one('go', 'Escape'),
  next: held('feed', 'J', 'ArrowDown'),
  prev: held('feed', 'K', 'ArrowUp'),
  top: one('feed', 'Home'),
  timeNewer: one('feed', '['),
  timeOlder: one('feed', ']'),
  timeBack: one('feed', 'Backspace'),
  filter: one('feed', '/'),
  filterLeave: one('feed', 'Escape'),
  thread: one('note', 'Enter'),
  reply: one('note', 'R'),
  like: one('note', 'L'),
  react: one('note', 'E'),
  repost: one('note', 'T'),
  bookmark: one('note', 'B'),
  media: one('note', 'M'),
  profile: one('note', 'U'),
  moment: one('note', 'A'),
  send: one('compose', 'Mod+Enter'),
  viewerClose: one('viewer', 'Escape'),
  viewerLeft: held('viewer', 'ArrowLeft'),
  viewerRight: held('viewer', 'ArrowRight'),
  viewerPrev: one('viewer', 'PageUp'),
  viewerNext: one('viewer', 'PageDown'),
  zoomIn: held('viewer', 'Plus', '='),
  zoomOut: held('viewer', '-'),
  zoomFit: one('viewer', '0'),
  play: one('viewer', ' ', 'K'),
  mute: one('viewer', 'M'),
  volumeUp: held('viewer', 'ArrowUp'),
  volumeDown: held('viewer', 'ArrowDown'),
  fullscreen: one('viewer', 'F'),
  clickBehind: one('pointer', 'MiddleClick'),
  clickSplit: one('pointer', 'Shift+Click'),
  clickFile: one('pointer', 'Mod+Click'),
  tabMiddle: one('pointer', 'MiddleClick'),
  stripWheel: one('pointer', 'Wheel'),
} as const satisfies Record<string, Binding>;
export type KeyId = keyof typeof KEYS;
export const KEY_GROUPS: readonly KeyGroup[] = [
  'go',
  'feed',
  'note',
  'compose',
  'viewer',
  'window',
  'pointer',
];

/** The words for a binding and for a group: the string tables must have them (checked by the compiler). */
export const keyText = (id: KeyId): Key => `key.${id}`;
export const groupText = (group: KeyGroup): Key => `keys.${group}`;

const hit = (e: KeyboardEvent, combo: string): boolean =>
  combo === 'Plus'
    ? e.key === '+' && !e.ctrlKey && !e.metaKey && !e.altKey
    : matches(e, combo) && (combo !== '/' || e.key === '/');

/** Whether the key goes into a field: nothing but the field's own keys may act on it. */
export const typing = (e: Event): boolean =>
  Boolean((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable]'));
/** A cover lies over the tab whose element is `view` (a picture being looked at, `views/media.ts`): the tab's own
 * keys wait until it closes. */
export const covered = (view: Element): boolean =>
  view.nextElementSibling?.classList.contains('cover') === true;
/** Text is being composed (Japanese input): the key belongs to the input method. Safari reports the key that ends
 * a composition as an ordinary press, but with code 229. */
const composing = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229;

// Pairs (`G` then `H`). The first key arms for a moment; the next press is the second key, whatever it is.
const PAIR_MS = 1500;
const FIRSTS = [...new Set(Object.values(KEYS).flatMap((b: Binding) => b.after ?? []))];
const seconds = new WeakMap<Event, string>(); // bound: weak, one entry per key press being handled
let armed = { key: '', until: 0 };
/** Call once: watches every key press before anything else does, so a second key is never taken for its own. */
export function watchPairs(target: Pick<Window, 'addEventListener'>): void {
  target.addEventListener(
    'keydown',
    (e) => {
      if (composing(e) || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      const first = armed.until > e.timeStamp ? armed.key : '';
      armed = { key: '', until: 0 };
      if (typing(e)) return;
      if (first) seconds.set(e, first);
      else if (!e.repeat) {
        const key = FIRSTS.find((k) => matches(e, k));
        if (key) armed = { key, until: e.timeStamp + PAIR_MS };
      }
    },
    true,
  );
}

/** Which of the binding's combos the event is (-1: none). Never during text composition, never as a repeat of a
 * held key unless the binding moves something. */
export function pressedAt(e: KeyboardEvent, id: KeyId): number {
  const b: Binding = KEYS[id];
  if (composing(e) || (e.repeat && !b.held)) return -1;
  if ((seconds.get(e) ?? '') !== (b.after ?? '')) return -1;
  return b.combos.findIndex((c) => hit(e, c));
}
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
/** Pointer gestures are words, so they are translated. */
const WORDS: Record<string, Key> = {
  Click: 'cap.click',
  MiddleClick: 'cap.middle',
  Wheel: 'cap.wheel',
};
/** A combo as this device prints it. */
export const comboLabel = (combo: string, apple?: boolean): string =>
  keyLabel(
    combo
      .split('+')
      .map((p) => {
        const word = WORDS[p];
        return word ? t(word) : (NAMES[p] ?? p);
      })
      .join('+'),
    apple,
  );
/** The key caps of a binding: each alternative, or the two ends of a run. */
export function keyCaps(id: KeyId, apple?: boolean): string[] {
  const b: Binding = KEYS[id];
  const caps = b.combos.map((c) => (b.after ? `${b.after} ` : '') + comboLabel(c, apple));
  return b.run ? [`${caps[0]} … ${(b.combos[b.combos.length - 1] ?? '').split('+').pop()}`] : caps;
}
