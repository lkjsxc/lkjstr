import { vi } from 'vitest';
import { createAvatarClient } from '../src/engine/client-avatars.ts';
import type { Author, AvatarOutput, ToEngine } from '../src/engine/protocol.ts';
import { createAvatarOwner } from '../src/views/avatar-owner.ts';
import { avatar } from '../src/views/avatars.ts';

let serial = 0;
const disposers: (() => void)[] = [];
export const settleAvatars = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
};
export function avatarFixture() {
  const sent: ToEngine[] = [],
    intersections: IntersectionObserverCallback[] = [];
  const client = createAvatarClient({
    post: (message) => sent.push(message),
    listen() {},
    close() {},
  });
  const created = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation(() => `blob:avatar-${++serial}`);
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (
    this: HTMLElement,
  ) {
    return (this.isConnected && !this.closest('[hidden]')
      ? [this.getBoundingClientRect()]
      : []) as unknown as DOMRectList;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return new DOMRect(
      Number(this.dataset.x ?? 20),
      20,
      this.matches('[data-face]') ? 36 : 300,
      this.matches('[data-face]') ? 36 : 300,
    );
  });
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = computed(element);
    return new Proxy(style, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        if (key === 'visibility') return value || 'visible';
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
  function FakeIntersectionObserver(callback: IntersectionObserverCallback) {
    intersections.push(callback);
    return { observe() {}, unobserve() {}, disconnect() {}, takeRecords: () => [] };
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  let reduced = false;
  const changes = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_name: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_name: string, listener: () => void) => changes.delete(listener),
  }));
  const root = document.createElement('div');
  document.body.append(root);
  const owner = createAvatarOwner(root, client);
  const author = (picture = 'https://a.test/p'): Author => ({
    pubkey: (++serial).toString(16).padStart(64, '0'),
    npub: 'npub1fixture',
    name: 'Alice',
    picture,
  });
  const face = (a = author(), cls = 'av'): HTMLElement => {
    const node = avatar(a, cls);
    root.append(node);
    return node;
  };
  const wants = () => sent.filter((message) => message.t === 'avatar.want');
  const reply = (req: string, result: AvatarOutput['result']): void => {
    const blob = new Blob(['derived'], { type: 'image/webp' });
    client.receive({
      t: 'avatar',
      req,
      result,
      ...(result.status === 'ready'
        ? {
            blob,
            image: {
              edge: 160,
              sourceWidth: 800,
              sourceHeight: 600,
              bytes: blob.size,
              mime: blob.type,
            },
          }
        : {}),
    });
  };
  const motion = (on: boolean): void => {
    reduced = on;
    for (const listener of changes) listener();
  };
  const dispose = (): void => {
    owner.dispose();
    client.dispose();
    root.remove();
  };
  disposers.push(dispose);
  return {
    root,
    owner,
    client,
    sent,
    wants,
    reply,
    face,
    author,
    created,
    revoked,
    motion,
    intersections,
    dispose,
  };
}
export function resetAvatarFixtures(): void {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

export function avatarIntersection(target: HTMLElement, on: boolean): IntersectionObserverEntry {
  const rect = target.getBoundingClientRect();
  return {
    target,
    isIntersecting: on,
    intersectionRect: on ? rect : new DOMRect(),
    boundingClientRect: rect,
    rootBounds: new DOMRect(0, 0, innerWidth, innerHeight),
    intersectionRatio: on ? 1 : 0,
    time: performance.now(),
  };
}
