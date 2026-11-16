// Settings: flat, typed, schema-described so the Settings view renders itself (as in ytenrich). Stored on this
// device; only values that differ from the defaults are kept, so changed defaults reach untouched settings.
import { createSignal, type Signal } from './signal.ts';
import { kv } from './storage.ts';

export const DEFAULT_SETTINGS = {
  language: 'auto' as 'auto' | 'ja' | 'en',
  theme: 'system' as 'system' | 'light' | 'dark',
  uiScale: 1, // 1.00 = normal size
  tabScale: 1.2, // tab bars, on top of uiScale
  tabWidth: 0, // px; 0 fits each tab to its title
  closeClicks: 1, // clicks on × that close a tab (1 = at once)
  textSize: 15, // px, note text
  avatarSize: 36, // px, avatars in lists
  mediaHeight: 320, // px, the tallest a picture is drawn in a list
  foldLines: 12, // lines of a note shown before it folds (0 = never fold)
  relativeTime: false, // "3m" instead of the time of day
  showFilters: true, // the filter row at the top of timelines and notifications
  showRelayCount: false, // connected relays in the top bar
  linkPreviews: true,
  showSensitive: false, // content-warned notes open
  composeNew: false, // the composer key always opens a new tab instead of going to the open one
  dmWatch: true, // count-only private unread watch while this page is visible
  lockIdle: 0, // idle minutes; 0 leaves the session unlocked
  clientTag: true, // what the reader publishes says it was written with lkjstr
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

type Kind =
  | { type: 'bool' }
  | { type: 'number'; min: number; max: number; step?: number }
  | { type: 'enum'; options: readonly string[] };
/** Texts come from the string table: `set.<key>` reads "Group: Title", `set.<key>.d` describes it. */
export type SettingField = { key: SettingKey } & Kind;

const BOOL: Kind = { type: 'bool' };
const num = (min: number, max: number, step?: number): Kind =>
  step ? { type: 'number', min, max, step } : { type: 'number', min, max };
const field = (key: SettingKey, kind: Kind): SettingField => ({ key, ...kind });

export const SETTINGS_SCHEMA: readonly SettingField[] = [
  field('language', { type: 'enum', options: ['auto', 'ja', 'en'] }),
  field('theme', { type: 'enum', options: ['system', 'light', 'dark'] }),
  field('textSize', num(11, 28)),
  field('avatarSize', num(16, 72)),
  field('mediaHeight', num(80, 1600, 10)),
  field('foldLines', num(0, 200)),
  field('relativeTime', BOOL),
  field('showFilters', BOOL),
  field('showSensitive', BOOL),
  field('linkPreviews', BOOL),
  field('uiScale', num(0.5, 2, 0.05)),
  field('tabScale', num(0.8, 2, 0.05)),
  field('tabWidth', num(0, 400)),
  field('closeClicks', num(1, 5)),
  field('showRelayCount', BOOL),
  field('composeNew', BOOL),
  field('clientTag', BOOL),
  field('dmWatch', BOOL),
  field('lockIdle', num(0, 10080, 1)),
];

export const SETTINGS_KEY = 'settings';

export function parseSettings(value: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof value !== 'object' || value === null) return out;
  const raw = value as Record<string, unknown>;
  for (const f of SETTINGS_SCHEMA) {
    const v = raw[f.key];
    const ok =
      f.type === 'bool'
        ? typeof v === 'boolean'
        : f.type === 'number'
          ? typeof v === 'number' && v >= f.min && v <= f.max
          : typeof v === 'string' && f.options.includes(v);
    if (ok) (out as Record<string, unknown>)[f.key] = v;
  }
  return out;
}

/** The settings of this page, kept current with the other browser tabs. */
export function createSettings(): Signal<Settings> & {
  patch(p: Partial<Settings>): void;
  dispose(): void;
} {
  const signal = createSignal(parseSettings(kv.get(SETTINGS_KEY)));
  const off = kv.onChanged((key, value) => {
    if (key === SETTINGS_KEY) signal.set(parseSettings(value));
  });
  return {
    ...signal,
    patch(p) {
      const next = parseSettings({ ...signal.get(), ...p });
      const diff = Object.entries(next).filter(([k, v]) => v !== DEFAULT_SETTINGS[k as SettingKey]);
      kv.set(SETTINGS_KEY, Object.fromEntries(diff));
      signal.set(next);
    },
    dispose: off,
  };
}
export type SettingsStore = ReturnType<typeof createSettings>;
