import { kv } from './storage.ts';

/** Native players share device preferences; playback itself never restarts on reload. */
export function keepMediaPreferences(el: HTMLMediaElement): () => void {
  const saved = kv.get('volume') as
    | { volume?: unknown; muted?: unknown; rate?: unknown }
    | undefined;
  if (typeof saved?.volume === 'number') el.volume = Math.min(1, Math.max(0, saved.volume));
  el.muted = saved?.muted === true;
  if (typeof saved?.rate === 'number' && saved.rate >= 0.25 && saved.rate <= 4)
    el.defaultPlaybackRate = el.playbackRate = saved.rate;
  const keep = (): void => {
    if (el.defaultPlaybackRate !== el.playbackRate) el.defaultPlaybackRate = el.playbackRate;
    kv.set('volume', { volume: el.volume, muted: el.muted, rate: el.playbackRate });
  };
  el.addEventListener('volumechange', keep);
  el.addEventListener('ratechange', keep);
  return () => {
    el.removeEventListener('volumechange', keep);
    el.removeEventListener('ratechange', keep);
  };
}
