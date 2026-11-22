// The app subtree owns faces, including portalled menus. Detached render candidates never acquire.
import type { AvatarClient } from '../engine/client-avatars.ts';
import { onPerson } from '../shared/people.ts';
import { createAvatarDraw } from './avatar-draw.ts';
import { visibleAvatars } from './avatar-visible.ts';
import { avatarModel, refreshAvatar, updateAvatar } from './avatars.ts';

export function createAvatarOwner(root: HTMLElement, client: AvatarClient) {
  const faces = new Map<HTMLElement, ReturnType<typeof createAvatarDraw>>(); // Current mounted subtree only.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false,
    running = false,
    generation = 0,
    queued: number | undefined;
  let intersection: IntersectionObserver | undefined, mutations: MutationObserver | undefined;
  const scan = (): void => {
    if (!running) return;
    const wanted = new Set(root.querySelectorAll<HTMLElement>('[data-face]'));
    if (root.matches('[data-face]')) wanted.add(root);
    const visible = visibleAvatars(root);
    // Acquire replacements before releasing removed nodes: exact-URL work/object URLs survive a row redraw.
    for (const face of wanted) {
      if (!avatarModel(face)) continue;
      let draw = faces.get(face);
      if (!draw) {
        draw = createAvatarDraw(face, client, () => motion.matches);
        faces.set(face, draw);
        intersection?.observe(face);
      }
      refreshAvatar(face);
      draw.active(visible(face));
    }
    for (const [face, draw] of faces)
      if (!wanted.has(face)) {
        intersection?.unobserve(face);
        draw.dispose();
        faces.delete(face);
      }
  };
  const schedule = (): void => {
    if (!running || queued === generation) return;
    const token = generation;
    queued = token;
    queueMicrotask(() => {
      if (queued === token) queued = undefined;
      if (token === generation) scan();
    });
  };
  const hasFace = (node: Node): boolean =>
    node instanceof Element && (node.matches('[data-face]') || !!node.querySelector('[data-face]'));
  const pause = (): void => {
    running = false;
    generation++;
    queued = undefined;
    mutations?.disconnect();
    intersection?.disconnect();
    mutations = undefined;
    intersection = undefined;
    for (const draw of faces.values()) draw.dispose();
    faces.clear();
  };
  const resume = (): void => {
    if (disposed || document.visibilityState === 'hidden') return pause();
    if (running) return schedule();
    running = true;
    const token = ++generation;
    intersection = new IntersectionObserver(
      (entries) => {
        if (!running || token !== generation) return;
        const visible = visibleAvatars(root);
        // Entries may predate a later hide/show mutation in this same root generation.
        for (const entry of entries) {
          const face = entry.target as HTMLElement;
          faces.get(face)?.active(visible(face));
        }
      },
      { threshold: [0, Number.EPSILON] },
    );
    mutations = new MutationObserver((entries) => {
      if (token !== generation) return;
      if (
        entries.some((entry) =>
          entry.type === 'attributes'
            ? hasFace(entry.target)
            : [...entry.addedNodes, ...entry.removedNodes].some(hasFace),
        )
      )
        schedule();
    });
    mutations.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style'],
    });
    scan();
  };
  const offPeople = onPerson((author) => {
    for (const face of faces.keys())
      if (face.dataset.face === author.pubkey) updateAvatar(face, author);
  });
  const offCapacity = client.onCapacity(schedule);
  const changedMotion = (): void => {
    for (const draw of faces.values()) draw.refresh();
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    pause();
    offPeople();
    offCapacity();
    motion.removeEventListener('change', changedMotion);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', resume);
  };
  const pagehide = (event: PageTransitionEvent): void => {
    if (event.persisted) pause();
    else dispose();
  };
  motion.addEventListener('change', changedMotion);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', resume);
  resume();
  return { refresh: schedule, dispose };
}
