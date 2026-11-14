// A video or a sound in the media tab: the browser's own controls, plus the keys of the Shortcuts tab. It never
// starts by itself (only the press that opened it starts it), keeps the volume chosen on this device, and reports
// where it is so a redrawn or restored tab continues from there.
import type { Media } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { pressed } from '../shared/keys.ts';
import { kv } from '../shared/storage.ts';

export type Player = {
  readonly el: HTMLMediaElement;
  /** Handles a key of the player; false when the key is not one. */
  key(e: KeyboardEvent): boolean;
  /** Stops the sound and reports the position (the tab went behind another, or closes). */
  pause(): void;
  dispose(): void;
};
export type PlayerOpts = {
  /** Seconds to continue from. */
  readonly at?: number;
  /** The reader pressed play on this very file to get here. */
  readonly start: boolean;
  position(seconds: number): void;
  failed(): void;
};

const VOLUME = 'volume';
const SEEK = 5;
const REPORT_MS = 5000;

export function createPlayer(m: Media, o: PlayerOpts): Player {
  const el: HTMLMediaElement = h(m.type === 'audio' ? 'audio' : 'video', {
    src: m.url,
    controls: true,
    preload: 'metadata',
  });
  if (el instanceof HTMLVideoElement) {
    el.setAttribute('playsinline', '');
    if (m.thumb) el.poster = m.thumb;
  }
  if (m.alt) el.setAttribute('aria-label', m.alt);
  const saved = kv.get(VOLUME) as { volume?: unknown; muted?: unknown } | undefined;
  if (typeof saved?.volume === 'number') el.volume = Math.min(1, Math.max(0, saved.volume));
  el.muted = saved?.muted === true;

  let reported = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let gone = false;
  const report = (): void => {
    if (gone) return;
    reported = Date.now();
    o.position(el.ended ? 0 : el.currentTime);
  };
  const on = <K extends keyof HTMLMediaElementEventMap>(type: K, fn: () => void): void =>
    el.addEventListener(type, fn);
  on('loadedmetadata', () => {
    const at = o.at ?? 0;
    if (at > 0 && (!Number.isFinite(el.duration) || at < el.duration - 1)) el.currentTime = at;
  });
  on('timeupdate', () => void (Date.now() - reported > REPORT_MS && report()));
  on('pause', report);
  on('seeked', report);
  on('ended', report);
  on('error', () => void (gone || o.failed()));
  on('volumechange', () => {
    clearTimeout(timer);
    timer = setTimeout(() => kv.set(VOLUME, { volume: el.volume, muted: el.muted }), 300);
  });
  if (o.start) void el.play().catch(() => undefined); // refused by the browser: the controls are there

  const seek = (by: number): void => {
    const end = Number.isFinite(el.duration) ? el.duration : Number.MAX_VALUE;
    el.currentTime = Math.min(end, Math.max(0, el.currentTime + by));
  };
  const louder = (by: number): void => {
    el.volume = Math.min(1, Math.max(0, Math.round((el.volume + by) * 10) / 10));
    if (by > 0) el.muted = false;
  };
  return {
    el,
    key(e) {
      if (pressed(e, 'play')) void (el.paused ? el.play().catch(() => undefined) : el.pause());
      else if (pressed(e, 'viewerLeft')) seek(-SEEK);
      else if (pressed(e, 'viewerRight')) seek(SEEK);
      else if (pressed(e, 'volumeUp')) louder(0.1);
      else if (pressed(e, 'volumeDown')) louder(-0.1);
      else if (pressed(e, 'mute')) el.muted = !el.muted;
      else if (pressed(e, 'fullscreen') && el instanceof HTMLVideoElement)
        void (
          document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()
        )?.catch(() => undefined);
      else return false;
      return true;
    },
    pause() {
      if (!el.paused) el.pause();
      else report();
    },
    dispose() {
      gone = true; // a closed tab leaves no position behind
      clearTimeout(timer);
      el.pause();
      el.removeAttribute('src'); // lets go of the file
      el.load();
    },
  };
}
