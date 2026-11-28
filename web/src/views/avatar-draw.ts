// Draw-only face ownership: no fetch, readback, encoder or durable cache on the page.
import { loadAvatar } from '../engine/avatar-cache.ts';
import type { AvatarClient, AvatarValue } from '../engine/client-avatars.ts';
import { h } from '../shared/h.ts';
import { mediaSource } from '../shared/media-source.ts';
import { avatarModel, avatarOptions, observeAvatar, reportAvatarImage } from './avatars.ts';

export function createAvatarDraw(el: HTMLElement, client: AvatarClient, reduced: () => boolean) {
  let active = false,
    visible = false,
    motion = false,
    generation = 0,
    key: string | undefined;
  let lease: (() => void) | undefined, image: HTMLImageElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  let mediaMotion: boolean | undefined;
  const onImage = avatarOptions(el).onImage;
  const report = (url?: string): void => reportAvatarImage(el, url);
  let releaseImage: (() => void) | undefined, render: (() => void) | undefined;
  let shown: string | undefined, canvasSource: string | undefined;
  const clearCanvas = (): void => {
    if (!canvas) return;
    canvas.remove();
    canvas.width = canvas.height = 0;
    canvas = undefined;
    canvasSource = undefined;
  };
  const clearImage = (keepCanvas = false): void => {
    shown = keepCanvas && canvasSource ? JSON.stringify([canvasSource, true, false]) : undefined;
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
    if (!keepCanvas) clearCanvas();
  };
  const stop = (): void => {
    generation++;
    key = undefined;
    render = undefined;
    clearImage();
    const release = lease;
    lease = undefined;
    release?.();
  };
  const freezeImage = (img: HTMLImageElement, token: number, url: string): void => {
    if (!active || generation !== token || image !== img) return;
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
        clearCanvas();
        canvas = still;
        canvasSource = url;
        el.append(still);
        report(avatarModel(el)?.picture);
      } else {
        still.width = still.height = 0;
        report();
      }
    } catch {
      still.width = still.height = 0;
      report();
    }
    img.onload = img.onerror = null;
    img.remove();
    const release = releaseImage;
    releaseImage = undefined;
    image = undefined;
    // Release after all native load listeners, including the shared URL's other waiters.
    setTimeout(() => {
      if (release) release();
      else img.removeAttribute('src');
    }, 0);
  };
  const show = (url: string, freeze: boolean, token: number, derived = false): void => {
    const next = JSON.stringify([url, freeze, derived]);
    if (shown === next) return; // A ready derivative is already a still, including after a motion change.
    if (freeze && !derived && canvas && canvasSource === url) {
      clearImage(true);
      report(avatarModel(el)?.picture);
      return;
    }
    if (freeze && !derived && image && shown === JSON.stringify([url, false, false])) {
      // Freeze the current decoded/in-flight source; never refetch an animation to stop it.
      shown = next;
      const current = image;
      current.remove();
      current.onload = () => freezeImage(current, token, url);
      if (current.complete && current.naturalWidth) freezeImage(current, token, url);
      return;
    }
    if (!derived && !visible) return; // The halo never starts a new original-image request.
    const holdCanvas = canvas && !freeze && !derived && canvasSource === url;
    clearImage(!!holdCanvas);
    shown = next;
    const img = h('img', {
      alt: '',
      width: 36,
      height: 36,
      loading: 'eager',
      fetchpriority: 'high',
      decoding: derived ? 'sync' : 'async',
      draggable: false,
      referrerpolicy: 'no-referrer',
    });
    image = img;
    const live = (): boolean => active && generation === token && image === img;
    const failed = (): void => {
      if (live()) report();
    };
    img.onerror = () => {
      if (live() && derived) {
        failed();
        clearImage();
        shown = next; // Failed bytes stay terminal until the source or ownership generation changes.
      }
    };
    if (freeze) img.onload = () => freezeImage(img, token, url);
    else {
      img.onload = () => {
        if (!live()) return;
        clearCanvas();
        report(avatarModel(el)?.picture);
      };
      el.append(img);
    }
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
    const model = avatarModel(el),
      picture = model?.picture;
    const nextMotion = reduced(),
      preview = avatarOptions(el).preview,
      original = el.classList.contains('xl') && !nextMotion;
    const next = JSON.stringify([model?.pubkey, picture, original, preview]);
    // A confirmed link survives the visibility pause so Escape can focus it again.
    // A different motion path must earn a new link, as must changed metadata.
    if (
      mediaMotion !== undefined &&
      mediaMotion !== nextMotion &&
      (key !== next || !shown?.endsWith(',true]'))
    )
      report();
    mediaMotion = nextMotion;
    if (!active) return;
    if (key === next) {
      if (motion !== nextMotion || visible) {
        motion = nextMotion;
        render?.();
      }
      return;
    }
    stop();
    key = next;
    motion = nextMotion;
    if (!picture) return;
    // Preserve live media safety and HTTPS upgrading; keep exact HTTPS identity for leases.
    const source = mediaSource(picture);
    if (!source) return report();
    const url = picture.startsWith('https://') && !/[\s\p{Cc}]/u.test(picture) ? picture : source;
    const token = generation;
    if (preview || original || (!url.startsWith('https://') && !url.startsWith('data:'))) {
      render = () => show(url, reduced(), token);
      render();
      return;
    }
    const receive = (value: AvatarValue): void => {
      if (!active || generation !== token) return;
      render = () => {
        if (value.kind === 'ready') show(value.url, false, token, true);
        else if (value.kind === 'fallback') {
          if (reduced() && value.uniform) {
            clearImage();
            report();
          } else show(url, reduced(), token);
        } else {
          clearImage();
          if (value.kind === 'rejected') report();
        }
      };
      render();
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
    active(on: boolean, onScreen = on): void {
      visible = onScreen;
      // A queued native original must not start later from the warm region as if it were visible.
      if (!visible && releaseImage && image && !image.hasAttribute('src')) clearImage(true);
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
