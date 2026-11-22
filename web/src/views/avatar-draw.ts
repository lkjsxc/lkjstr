// Draw-only face ownership: no fetch, readback, encoder or durable cache on the page.
import type { AvatarClient, AvatarValue } from '../engine/client-avatars.ts';
import { h } from '../shared/h.ts';
import { avatarModel, observeAvatar } from './avatars.ts';

export function createAvatarDraw(el: HTMLElement, client: AvatarClient, reduced: () => boolean) {
  let active = false,
    generation = 0,
    key: string | undefined;
  let lease: (() => void) | undefined, image: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const clearImage = (): void => {
    if (image) {
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      image.remove();
      image = undefined;
    }
    if (canvas) {
      canvas.remove();
      canvas.width = canvas.height = 0;
      canvas = undefined;
    }
  };
  const stop = (): void => {
    generation++;
    key = undefined;
    clearImage();
    const release = lease;
    lease = undefined;
    release?.();
  };
  const show = (url: string, freeze: boolean, token: number): void => {
    clearImage();
    const img = h('img', { alt: '', decoding: 'async', draggable: false });
    image = img;
    const live = (): boolean => active && generation === token && image === img;
    img.onerror = () => {
      if (live()) clearImage();
    };
    if (freeze) {
      img.onload = () => {
        if (!live()) return;
        const rect = el.getBoundingClientRect();
        const edge = Math.max(
          1,
          Math.min(512, Math.ceil(Math.min(rect.width, rect.height) * devicePixelRatio)),
        );
        const still = h('canvas', { width: edge, height: edge, 'aria-hidden': 'true' });
        const context = still.getContext('2d');
        if (!context || !img.naturalWidth || !img.naturalHeight) return clearImage();
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        try {
          // One display-sized blit; a tainted canvas is never read, encoded or retained.
          context.drawImage(
            img,
            (img.naturalWidth - side) / 2,
            (img.naturalHeight - side) / 2,
            side,
            side,
            0,
            0,
            edge,
            edge,
          );
          canvas = still;
          el.append(still);
        } catch {
          still.width = still.height = 0;
        }
        img.onload = img.onerror = null;
        img.removeAttribute('src');
        image = undefined;
      };
    } else el.append(img);
    img.src = url;
  };
  const update = (): void => {
    const url = avatarModel(el)?.picture;
    const motion = reduced(),
      original = el.classList.contains('xl') && !motion;
    const next = JSON.stringify([url, motion, original]);
    if (!active || key === next) return;
    stop();
    key = next;
    if (!url) return;
    const token = generation;
    if (original) return show(url, false, token);
    const receive = (value: AvatarValue): void => {
      if (!active || generation !== token) return;
      if (value.kind === 'ready') show(value.url, false, token);
      else if (value.kind === 'fallback') {
        if (motion && value.uniform) clearImage();
        else show(url, motion, token);
      } else clearImage();
    };
    lease = client.acquire(url, receive);
    // Capacity deferral is a letter until the shared client announces room, never an original-image bypass.
    if (!lease) key = undefined;
  };
  const off = observeAvatar(el, update);
  return {
    active(on: boolean): void {
      if (on !== active) {
        active = on;
        if (!on) stop();
      }
      if (on) update();
    },
    refresh: update,
    dispose(): void {
      active = false;
      stop();
      off();
    },
  };
}
