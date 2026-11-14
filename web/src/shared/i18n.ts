// One string table, two languages. Japanese is written as Japanese, not translated word for word.
import { en } from './strings-en.ts';
import { ja } from './strings-ja.ts';

export type Key = keyof typeof en;
export type Lang = 'en' | 'ja';
const TABLES: Record<Lang, Record<Key, string>> = { en, ja };
let lang: Lang = 'en';

export const getLang = (): Lang => lang;
export const setLang = (next: Lang): void => void (lang = next);
/** The language a setting means: `auto` follows the browser. */
export const resolveLang = (setting: string, nav = globalThis.navigator?.language ?? 'en'): Lang =>
  setting === 'ja' || setting === 'en' ? setting : nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';

const fill = (text: string, vars?: Record<string, string | number>): string =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => String(vars[k] ?? m)) : text;

export const t = (key: Key, vars?: Record<string, string | number>): string =>
  fill(TABLES[lang][key], vars);
/** Both languages' wording, lower-case: what searches match, whatever the interface language. */
export const both = (key: Key): string => `${en[key]} ${ja[key]}`.toLowerCase();
export const hasKey = (key: string): key is Key => key in en;
