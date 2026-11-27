import type { Signal } from '../shared/signal.ts';

const PENDING = '[data-pending-image]';
type Load = () => void;
export type NoteImageQueue = (box: HTMLElement, load: Load) => void;

/** An inline image can share the request once its own box is near the viewport. */
export function createNoteImageQueue(
  root: HTMLElement,
  visible: Pick<Signal<boolean>, 'get' | 'subscribe'>,
) {
  if (typeof IntersectionObserver === 'undefined')
    return { add: undefined, dispose: () => undefined };

  const loaders = new WeakMap<Element, Load>();
  let watching = false;
  const intersection = new IntersectionObserver(
    (entries) => {
      if (!watching) return;
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting || !root.contains(target)) continue;
        intersection.unobserve(target);
        const load = loaders.get(target);
        loaders.delete(target);
        target.removeAttribute('data-pending-image');
        load?.();
      }
    },
    { root, rootMargin: '600px 0px' },
  );
  const boxesIn = (node: Node, use: (box: Element) => void): void => {
    if (!(node instanceof Element)) return;
    if (loaders.has(node)) use(node);
    for (const box of node.querySelectorAll(PENDING)) use(box);
  };
  const added = (box: Element): void => {
    if (root.contains(box)) intersection.observe(box);
  };
  const removed = (box: Element): void => {
    if (!root.contains(box)) intersection.unobserve(box);
  };
  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) boxesIn(node, removed);
      for (const node of record.addedNodes) boxesIn(node, added);
    }
  });
  const stop = (): void => {
    watching = false;
    mutations.disconnect();
    intersection.disconnect();
    intersection.takeRecords();
  };
  const sync = (): void => {
    const show = visible.get() && document.visibilityState !== 'hidden';
    if (show === watching) return;
    if (!show) return stop();
    watching = true;
    mutations.observe(root, { childList: true, subtree: true });
    for (const box of root.querySelectorAll(PENDING)) intersection.observe(box);
  };
  const off = visible.subscribe(sync);
  document.addEventListener('visibilitychange', sync);
  sync();
  return {
    add(box: HTMLElement, load: Load): void {
      box.dataset.pendingImage = '';
      loaders.set(box, load);
      if (watching) added(box);
    },
    dispose() {
      stop();
      off();
      document.removeEventListener('visibilitychange', sync);
    },
  };
}
