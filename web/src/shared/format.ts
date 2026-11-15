// Times and counts as lkjstr prints them. Dates are absolute: `yyyy/mm/dd`, and `HH:mm` within the day. Relative
// time ("3m") exists only as a setting.
import type { Lang } from './i18n.ts';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar day, `yyyy/mm/dd`. */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
/** Local time of day, `HH:mm`. */
export function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** Everything, for tooltips: `yyyy/mm/dd HH:mm:ss`. */
export const fullTime = (ms: number): string =>
  `${dayOf(ms)} ${clockOf(ms)}:${pad(new Date(ms).getSeconds())}`;

export function relativeTime(ms: number, now: number, lang: Lang): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  const ja = lang === 'ja';
  if (s < 60) return ja ? `${s}秒前` : `${s}s`;
  if (s < 3600) return ja ? `${Math.floor(s / 60)}分前` : `${Math.floor(s / 60)}m`;
  if (s < 86_400) return ja ? `${Math.floor(s / 3600)}時間前` : `${Math.floor(s / 3600)}h`;
  if (s < 86_400 * 30) return ja ? `${Math.floor(s / 86_400)}日前` : `${Math.floor(s / 86_400)}d`;
  return dayOf(ms);
}

export type TimeStyle = { readonly relative: boolean; readonly lang: Lang };
/** The time without a day separator: `HH:mm` today; full date and time otherwise. */
export function noteTime(ms: number, now: number, style: TimeStyle): string {
  if (style.relative) return relativeTime(ms, now, style.lang);
  return dayOf(ms) === dayOf(now) ? clockOf(ms) : `${dayOf(ms)} ${clockOf(ms)}`;
}

/** A count: exact below 1000, then shortened (`1.2k`, `3.4M`; `1.2万` in Japanese). `partial` adds `+`. */
export function countText(n: number, partial: boolean, lang: Lang): string {
  const short = (v: number, unit: string): string =>
    `${v >= 100 ? Math.floor(v) : Math.floor(v * 10) / 10}${unit}`;
  let text = String(n);
  if (lang === 'ja') {
    if (n >= 100_000_000) text = short(n / 100_000_000, '億');
    else if (n >= 10_000) text = short(n / 10_000, '万');
  } else if (n >= 1_000_000) text = short(n / 1_000_000, 'M');
  else if (n >= 1000) text = short(n / 1000, 'k');
  return partial ? `${text}+` : text;
}
