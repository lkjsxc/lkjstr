// The app subtree owns faces, including portalled menus. Detached render candidates never acquire.
import type { AvatarClient } from '../engine/client-avatars.ts';
import { onPerson } from '../shared/people.ts';
import { createAvatarDraw } from './avatar-draw.ts';
import { AVATAR_MARGIN, visibleAvatars } from './avatar-visible.ts';
import { avatarModel, refreshAvatar, updateAvatar } from './avatars.ts';

export function createAvatarOwner(root: HTMLElement, client: AvatarClient) {
  const faces = new Map<HTMLElement, ReturnType<typeof createAvatarDraw>>(); // Current mounted subtree only.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false,
    running = false,
    generation = 0,
    queued: number | undefined,
    frame: number | undefined;
  let retained = new Set<HTMLElement>(); // At most the selected visible faces plus 32 nearby faces.
  let intersection: IntersectionObserver | undefined, mutations: MutationObserver | undefined;
  const scan = (mounted = true): void => {
    if (!running) return;
    const wanted = new Set(
      mounted ? root.querySelectorAll<HTMLElement>('[data-face]') : faces.keys(),
    );
    if (root.matches('[data-face]')) wanted.add(root);
    const visible = visibleAvatars(root),
      near = visibleAvatars(root, AVATAR_MARGIN);
    const onscreen: HTMLElement[] = [],
      nearby: HTMLElement[] = [];
    for (const face of wanted) {
      if (!avatarModel(face)) continue;
      let draw = faces.get(face);
      if (!draw) {
        draw = createAvatarDraw(face, client, () => motion.matches);
        faces.set(face, draw);
        intersection?.observe(face);
      }
      if (mounted) refreshAvatar(face);
      if (visible(face)) onscreen.push(face);
      else if (near(face)) nearby.push(face);
    }
    // Warm at most 32 faces, reserving URL admission for every actually visible face first.
    nearby.sort((a, b) => Number(retained.has(b)) - Number(retained.has(a)));
    const warm = nearby.slice(0, Math.max(0, Math.min(32, 256 - onscreen.length)));
    const selected = new Set([...onscreen, ...warm]);
    retained = selected;
    for (const face of onscreen) faces.get(face)!.active(true, true);
    for (const face of warm) faces.get(face)!.active(true, false);
    // Acquire replacements before removed owners release the shared URL. Capacity retries run before paint.
    for (const [face, draw] of faces) if (!selected.has(face)) draw.active(false);
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
  const scheduleGeometry = (): void => {
    if (!running || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      scan(false);
    });
  };
  const hasFace = (node: Node): boolean =>
    node instanceof Element && (node.matches('[data-face]') || !!node.querySelector('[data-face]'));
  const pause = (): void => {
    running = false;
    generation++;
    queued = undefined;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    retained.clear();
    mutations?.disconnect();
    intersection?.disconnect();
    mutations = undefined;
    intersection = undefined;
    for (const draw of faces.values()) draw.dispose();
    faces.clear();
    client.clearIdle();
  };
  const resume = (): void => {
    if (disposed || document.visibilityState === 'hidden') return pause();
    if (running) return schedule();
    running = true;
    const token = ++generation;
    intersection = new IntersectionObserver(
      () => {
        if (running && token === generation) scan(false);
      },
      { rootMargin: `${AVATAR_MARGIN}px 0px`, threshold: [0, Number.EPSILON] },
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
    window.removeEventListener('scroll', scheduleGeometry, true);
    window.removeEventListener('resize', scheduleGeometry);
  };
  const pagehide = (event: PageTransitionEvent): void => {
    if (event.persisted) pause();
    else dispose();
  };
  motion.addEventListener('change', changedMotion);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('pageshow', resume);
  // IO rootMargin does not expand nested scrollport clips. Their scrolls need fresh geometry too.
  window.addEventListener('scroll', scheduleGeometry, { capture: true, passive: true });
  window.addEventListener('resize', scheduleGeometry);
  resume();
  return { refresh: schedule, dispose };
}
