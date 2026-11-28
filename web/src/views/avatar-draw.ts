// Draw-only face ownership: no fetch, readback, encoder or durable cache on the page.
import { loadAvatar } from '../engine/avatar-cache.ts';
import type { AvatarClient, AvatarValue } from '../engine/client-avatars.ts';
import { h } from '../shared/h.ts';
import { mediaSource } from '../shared/media-source.ts';
import { avatarModel, avatarOptions, observeAvatar, reportAvatarImage } from './avatars.ts';

export function createAvatarDraw(el: HTMLElement, client: AvatarClient, reduced: () => boolean) {
  let active = false,
    generation = 0,
    key: string | undefined;
  let lease: (() => void) | undefined, image: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let mediaMotion: boolean | undefined;
  const onImage = avatarOptions(el).onImage;
  const report = (url?: string): void => reportAvatarImage(el, url);
  let releaseImage: (() => void) | undefined;
  const clearImage = (): void => {
    const native = releaseImage;
    releaseImage = undefined;
    native?.();
    if (image) {
      image.onload = image.onerror = null;
      // The native lane can still need this element for other waiting faces.
      if (!native) image.removeAttribute('src');
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
  const show = (url: string, freeze: boolean, token: number, derived = false): void => {
    clearImage();
    const img = h('img', {
      alt: '',
      width: 36,
      height: 36,
      loading: 'eager',
      fetchpriority: 'high',
      decoding: 'async',
      draggable: false,
      referrerpolicy: 'no-referrer',
    });
    image = img;
    const live = (): boolean => active && generation === token && image === img;
    const ready = (): void => {
      if (live()) report(avatarModel(el)?.picture);
    };
    const failed = (): void => {
      if (live()) report();
    };
    img.onerror = () => {
      if (live() && derived) {
        failed();
        clearImage();
      }
    };
    if (!freeze && onImage) img.onload = ready;
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
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        try {
          if (context && side) {
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
            ready();
          } else {
            still.width = still.height = 0;
            failed();
          }
        } catch {
          still.width = still.height = 0;
          failed();
        }
        img.onload = img.onerror = null;
        const release = releaseImage;
        releaseImage = undefined;
        image = undefined;
        // Native load listeners still own the source during this event. A task,
        // not a microtask, runs after all of them (including shared waiters).
        setTimeout(() => {
          if (release) release();
          else img.removeAttribute('src');
        }, 0);
      };
    } else el.append(img);
    if (derived) img.src = url;
    else {
      const model = avatarModel(el);
      releaseImage = loadAvatar(
        img,
        url,
        !!(avatarOptions(el).cachePublic && model?.profileId),
        true,
        onImage ? failed : undefined,
      );
    }
  };
  const update = (): void => {
    const picture = avatarModel(el)?.picture;
    const motion = reduced(),
      preview = avatarOptions(el).preview,
      original = el.classList.contains('xl') && !motion;
    // A confirmed link survives the visibility pause so Escape can focus it again.
    // A different motion path must earn a new link, as must changed metadata.
    if (mediaMotion !== undefined && mediaMotion !== motion) report();
    mediaMotion = motion;
    const next = JSON.stringify([picture, motion, original]);
    if (!active || key === next) return;
    stop();
    key = next;
    if (!picture) return;
    // Preserve live media safety and HTTPS upgrading; keep exact HTTPS identity for leases.
    const source = mediaSource(picture);
    if (!source) return report();
    const url = picture.startsWith('https://') && !/[\s\p{Cc}]/u.test(picture) ? picture : source;
    const token = generation;
    if (preview) {
      show(url, motion, token);
      return;
    }
    if (original) return show(url, false, token);
    if (!url.startsWith('https://') && !url.startsWith('data:')) return show(url, motion, token);
    const receive = (value: AvatarValue): void => {
      if (!active || generation !== token) return;
      if (value.kind === 'ready') show(value.url, false, token, true);
      else if (value.kind === 'fallback') {
        if (motion && value.uniform) {
          clearImage();
          report();
        } else show(url, motion, token);
      } else {
        clearImage();
        if (value.kind === 'rejected') report();
      }
    };
    lease = client.acquire(
      url,
      receive,
      !!(avatarOptions(el).cachePublic && avatarModel(el)?.profileId),
    );
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
