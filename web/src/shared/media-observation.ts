// Local-only, public image effect observations. No layout reads or additional timers.
export type ImageClass = 'avatars' | 'media' | 'emoji';
export type ImageContext = {
  readonly class: ImageClass;
  readonly slot:
    | 'avatar'
    | 'note-image'
    | 'media-view'
    | 'poster'
    | 'link-picture'
    | 'emoji'
    | 'media-playback';
  readonly view?: string;
  readonly firstVisibleMs?: number;
  readonly lane: 'L0' | 'L1' | 'L2' | 'L3' | 'Unknown';
};
export type ImageOutcome = 'ok' | 'network_error' | 'timeout' | 'cancelled';
export type ImageObservation = ImageContext & {
  readonly url: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly displaySize?: readonly [number, number];
  readonly outcome: ImageOutcome;
};
let sink: ((observation: ImageObservation) => void) | undefined;
export function observeImages(receive: (observation: ImageObservation) => void): () => void {
  sink = receive;
  return () => {
    if (sink === receive) sink = undefined;
  };
}
export function beginImageObservation(
  img: Element,
  url: string,
  context: ImageContext | undefined,
): (outcome: ImageOutcome) => void {
  const receive = sink;
  if (!receive || !context || !/^https?:\/\//i.test(url) || url.length > 2048) return () => {};
  const startMs = Date.now();
  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  const displaySize =
    width > 0 && height > 0 && width <= 16384 && height <= 16384
      ? ([width, height] as const)
      : undefined;
  let finished = false;
  return (outcome) => {
    if (finished) return;
    finished = true;
    if (sink !== receive) return;
    // The local Worker hashes the public resource URL synchronously and discards it.
    // A stopped transport must never affect the native image lifecycle.
    try {
      receive({ ...context, url, startMs, endMs: Date.now(), displaySize, outcome });
    } catch {
      /* observation only */
    }
  };
}
