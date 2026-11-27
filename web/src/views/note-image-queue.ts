import type { ImageRelease } from '../shared/media-source.ts';
import type { Signal } from '../shared/signal.ts';
import { type ImageDemand, joinImageLane, wakeImageLane } from './image-fetch-lane.ts';

const BOX = '[data-feed-image]';
const LOOKAHEAD = 1.5;
const KEEP = 4.5;
const CANCEL = 2.5;
const SETTLE_MS = 140;
const EVICT_MS = 240;
const FAST_PX_PER_MS = 2.5;

type Load = (done: () => void) => ImageRelease;
type Mounted = { release: ImageRelease; pending: boolean; farSince?: number };
export type NoteImageQueue = (box: HTMLElement, load: Load) => void;

/** Reserve boxes in the feed. Only nearby demand and held native images need active tracking. */
export function createNoteImageQueue(
  root: HTMLElement,
  visible: Pick<Signal<boolean>, 'get' | 'subscribe'>,
) {
  if (typeof IntersectionObserver === 'undefined')
    return { add: undefined, dispose: () => undefined };

  const loaders = new WeakMap<Element, Load>();
  const nearby = new Set<Element>();
  const mounted = new Map<Element, Mounted>();
  let leave: (() => void) | undefined;
  let intersection: IntersectionObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastTop = root.scrollTop;
  let lastScroll = -Infinity;
  let fast = false;

  const release = (box: Element, handoff = false): void => {
    mounted.get(box)?.release(handoff);
    mounted.delete(box);
  };
  const start = (box: Element, load: Load, done: () => void): void => {
    const entry: Mounted = { pending: true, release: () => {} };
    const finish = (): void => {
      if (entry.pending) {
        entry.pending = false;
        done();
      }
    };
    mounted.set(box, entry);
    const unload = load(finish);
    entry.release = (handoff) => {
      unload(handoff);
      finish();
    };
  };
  const demand = (): ImageDemand[] => {
    clearTimeout(timer);
    const now = performance.now();
    const top = root.getBoundingClientRect().top + root.clientTop;
    const height = root.clientHeight;
    const distance = (box: Element): number => {
      const rect = box.getBoundingClientRect();
      return Math.max(0, top - rect.bottom, rect.top - top - height) / height;
    };
    const slowAt = fast ? lastScroll + SETTLE_MS : now;
    let wakeAt = Infinity;
    for (const [box, entry] of mounted) {
      const away = distance(box);
      if (!root.contains(box)) {
        release(box, true);
      } else if (entry.pending && away >= CANCEL) {
        release(box);
      } else if (away < KEEP) {
        entry.farSince = undefined;
      } else {
        entry.farSince ??= now;
        const expiry = entry.farSince + EVICT_MS;
        if (expiry <= now) release(box);
        else wakeAt = Math.min(wakeAt, expiry);
      }
    }

    const ready: ImageDemand[] = [];
    if (height > 0) {
      for (const box of nearby) {
        if (mounted.has(box) || !root.contains(box)) continue;
        if (!box.matches(BOX)) {
          nearby.delete(box);
          intersection?.unobserve(box);
          continue;
        }
        const load = loaders.get(box);
        if (!load) continue;
        const away = distance(box);
        if (away > LOOKAHEAD) continue;
        if (now < slowAt) wakeAt = Math.min(wakeAt, slowAt);
        else ready.push({ distance: away, start: (done) => start(box, load, done) });
      }
    }
    if (wakeAt < Infinity) timer = setTimeout(wakeImageLane, Math.max(1, wakeAt - now));
    return ready;
  };
  const scroll = (): void => {
    const now = performance.now();
    const top = root.scrollTop;
    if (top !== lastTop) {
      const elapsed = Math.min(SETTLE_MS, Math.max(16, now - lastScroll));
      fast = Math.abs(top - lastTop) / elapsed > FAST_PX_PER_MS;
      lastScroll = now;
      lastTop = top;
    }
    wakeImageLane();
  };
  const observe = (): void => {
    intersection?.disconnect();
    nearby.clear();
    // IntersectionObserver percentage margins resolve against width.
    const margin = Math.ceil(root.clientHeight * LOOKAHEAD);
    intersection = new IntersectionObserver(
      (entries, observer) => {
        if (observer !== intersection) return;
        for (const { target, isIntersecting } of entries) {
          if (isIntersecting && root.contains(target)) nearby.add(target);
          else nearby.delete(target);
        }
        wakeImageLane();
      },
      { root, rootMargin: `${margin}px 0px` },
    );
    for (const box of root.querySelectorAll(BOX)) intersection.observe(box);
    wakeImageLane();
  };
  const resize = new ResizeObserver(observe);
  const change = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const update = (box: Element): void => {
      if (root.contains(box)) intersection?.observe(box);
      else {
        intersection?.unobserve(box);
        nearby.delete(box);
        release(box, true);
      }
    };
    if (loaders.has(node)) update(node);
    for (const box of node.querySelectorAll(BOX)) update(box);
  };
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) change(node);
      for (const node of record.addedNodes) change(node);
    }
    wakeImageLane();
  });
  const stop = (): void => {
    leave?.();
    leave = undefined;
    root.removeEventListener('scroll', scroll);
    mutations.disconnect();
    resize.disconnect();
    intersection?.disconnect();
    intersection = undefined;
    nearby.clear();
    clearTimeout(timer);
    for (const box of mounted.keys()) release(box);
  };
  const sync = (): void => {
    const show = visible.get() && document.visibilityState !== 'hidden';
    if (show === Boolean(leave)) return;
    if (!show) return stop();
    fast = false;
    lastTop = root.scrollTop;
    lastScroll = -Infinity;
    leave = joinImageLane(demand);
    root.addEventListener('scroll', scroll, { passive: true });
    mutations.observe(root, { childList: true, subtree: true });
    resize.observe(root);
    observe();
  };
  const off = visible.subscribe(sync);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    add(box: HTMLElement, load: Load): void {
      box.dataset.feedImage = '';
      loaders.set(box, load);
      if (root.contains(box)) intersection?.observe(box);
    },
    dispose() {
      stop();
      off();
      document.removeEventListener('visibilitychange', sync);
    },
  };
}
