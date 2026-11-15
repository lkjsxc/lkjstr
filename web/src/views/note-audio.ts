import { keepMediaPreferences } from '../shared/media-preferences.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import type { ViewEnv } from './registry.ts';

const release = new WeakMap<HTMLAudioElement, () => void>();
/** Seek positions belong to the note/tab; native volume, mute and speed belong to the device. */
export function keepNoteAudio(el: HTMLAudioElement, env: ViewEnv, id: string, key: string): void {
  const prefs = keepMediaPreferences(el);
  let last = 0;
  const restore = (): void => {
    const at = readNoteState(env.instance, id).audio?.[key] ?? 0;
    if (at > 0 && (!Number.isFinite(el.duration) || at < el.duration)) el.currentTime = at;
  };
  const save = (): void => {
    if (el.readyState < 1 || !Number.isFinite(el.currentTime)) return;
    const state = readNoteState(env.instance, id);
    const at = el.ended ? 0 : el.currentTime;
    if ((state.audio?.[key] ?? 0) === at) {
      last = Date.now();
      return;
    }
    const positions = { ...state.audio, [key]: at };
    // A note draws at most four media cells; retain at most eight indices across projections.
    writeNoteState(env.instance, id, {
      audio: Object.fromEntries(Object.entries(positions).slice(-8)),
    });
    last = Date.now();
  };
  const tick = (): void => {
    if (Date.now() - last > 5000) save();
  };
  el.addEventListener('loadedmetadata', restore);
  el.addEventListener('seeked', save);
  el.addEventListener('pause', save);
  el.addEventListener('ended', save);
  el.addEventListener('timeupdate', tick);
  release.set(el, () => {
    save();
    prefs();
    el.removeEventListener('loadedmetadata', restore);
    el.removeEventListener('seeked', save);
    el.removeEventListener('pause', save);
    el.removeEventListener('ended', save);
    el.removeEventListener('timeupdate', tick);
    el.pause();
    el.removeAttribute('src');
    el.load();
    release.delete(el);
  });
}

/** Move the already playing element, so metadata or a setting redraw does not interrupt it. */
export function reuseNoteAudio(old: HTMLElement, next: HTMLElement): void {
  const candidates = [...next.querySelectorAll<HTMLAudioElement>('.media audio')];
  const used = new Set<HTMLAudioElement>(); // bound: the four media cells
  for (const audio of old.querySelectorAll<HTMLAudioElement>('.media audio')) {
    const replacement = candidates.find((n) => !used.has(n) && n.src === audio.src);
    if (!replacement) continue;
    used.add(replacement);
    release.get(replacement)?.();
    replacement.replaceWith(audio);
  }
}
export function pauseNoteAudio(root: HTMLElement): void {
  for (const audio of root.querySelectorAll<HTMLAudioElement>('.media audio')) audio.pause();
}
export function disposeNoteAudio(root: HTMLElement): void {
  for (const audio of root.querySelectorAll<HTMLAudioElement>('.media audio'))
    release.get(audio)?.();
}
