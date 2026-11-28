// The app subtree owns faces, including portalled menus. Detached render candidates never acquire.
import type { AvatarClient } from '../engine/client-avatars.ts';
import { onPerson } from '../shared/people.ts';
import { createAvatarDraw } from './avatar-draw.ts';
import { AVATAR_MARGIN, visibleAvatars } from './avatar-visible.ts';
import { avatarModel, refreshAvatar, updateAvatar } from './avatars.ts';

export function createAvatarOwner(root: HTMLElement, client: AvatarClient) {
  // Current mounted subtree only. `rank` is -1 until the face first holds a lease.
  const faces = new Map<HTMLElement, { draw: ReturnType<typeof createAvatarDraw>; rank: number }>();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Data saver asks only for faces on or next to the screen; everything already drawn still stays.
  const sparing = (): boolean =>
    (navigator as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  let disposed = false,
    queued = false,
    frame: number | undefined;
  /** Every mounted face keeps its picture. Position only orders the asking: screen, next rows, the rest. */
  const scan = (mounted = true): void => {
    if (disposed || document.visibilityState === 'hidden') return;
    const wanted = new Set(
      mounted ? root.querySelectorAll<HTMLElement>('[data-face]') : faces.keys(),
    );
    if (root.matches('[data-face]')) wanted.add(root);
    const visible = visibleAvatars(root),
      near = visibleAvatars(root, Math.max(AVATAR_MARGIN, innerHeight));
    const ranked: HTMLElement[][] = [[], [], []];
    for (const face of wanted) {
      if (!avatarModel(face)) continue;
      if (!faces.has(face)) {
        faces.set(face, { draw: createAvatarDraw(face, client, () => motion.matches), rank: -1 });
        intersection.observe(face);
      }
      if (mounted) refreshAvatar(face);
      ranked[visible(face) ? 0 : near(face) ? 1 : 2]!.push(face);
    }
    const spare = sparing();
    ranked.forEach((list, rank) => {
      for (const face of list) {
        const held = faces.get(face)!;
        if (rank === 2 && spare && held.rank < 0) continue;
        // Scroll frames touch only faces whose place changed; mount and capacity scans retry every face.
        if (!mounted && held.rank === rank) continue;
        held.rank = rank;
        held.draw.active(true, rank);
      }
    });
    for (const [face, held] of faces)
      if (!wanted.has(face)) {
        intersection.unobserve(face);
        held.draw.dispose();
        faces.delete(face);
      }
  };
  const schedule = (): void => {
    if (disposed || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      scan();
    });
  };
  const scheduleGeometry = (): void => {
    if (disposed || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      scan(false);
    });
  };
  const hasFace = (node: Node): boolean =>
    node instanceof Element && (node.matches('[data-face]') || !!node.querySelector('[data-face]'));
  const intersection = new IntersectionObserver(() => scan(false), {
    rootMargin: `${AVATAR_MARGIN}px 0px`,
    threshold: [0, Number.EPSILON],
  });
  const mutations = new MutationObserver((entries) => {
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
  const offPeople = onPerson((author) => {
    for (const face of faces.keys())
      if (face.dataset.face === author.pubkey) updateAvatar(face, author);
  });
  const offCapacity = client.onCapacity(schedule);
  const changedMotion = (): void => {
    for (const held of faces.values()) held.draw.refresh();
  };
  // A hidden tab or a page in the back/forward cache keeps its faces and pictures; the return only rescans.
  const resume = (): void => scan();
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    if (frame !== undefined) cancelAnimationFrame(frame);
    mutations.disconnect();
    intersection.disconnect();
    for (const held of faces.values()) held.draw.dispose();
    faces.clear();
    offPeople();
    offCapacity();
    motion.removeEventListener('change', changedMotion);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('pageshow', resume);
    window.removeEventListener('scroll', scheduleGeometry, true);
    window.removeEventListener('resize', scheduleGeometry);
  };
  const pagehide = (event: PageTransitionEvent): void => {
    if (!event.persisted) dispose();
  };
  motion.addEventListener('change', changedMotion);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', resume);
  // IO rootMargin does not expand nested scrollport clips. Their scrolls need fresh geometry too.
  window.addEventListener('scroll', scheduleGeometry, { capture: true, passive: true });
  window.addEventListener('resize', scheduleGeometry);
  scan();
  return { refresh: schedule, dispose };
}
