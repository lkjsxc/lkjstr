import { afterEach, expect, it, vi } from 'vitest';
import type { ChannelRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { learnPerson } from '../src/shared/people.ts';
import { mountChannelDesk } from '../src/views/channel-desk.ts';
import { mountChannels } from '../src/views/channels.ts';
import { renderProfile } from '../src/views/rows.ts';
import { avatarFixture, resetAvatarFixtures, settleAvatars } from './avatar-support.ts';
import { row, setup } from './profile-edit-fixture.ts';

afterEach(() => {
  resetAvatarFixtures();
  localStorage.clear();
  setLang('en');
});

function profile(picture?: string, banner?: string) {
  setLang('en');
  const x = avatarFixture();
  const { env } = setup();
  const author = { ...x.author(), picture };
  const model = row(author.pubkey, { author, banner });
  const el = renderProfile(model, env);
  x.root.append(el);
  return { ...x, env, el, model };
}

function loaded(el: HTMLElement, selector: string): HTMLAnchorElement {
  const img = el.querySelector<HTMLImageElement>(selector)!;
  expect(img).not.toBeNull();
  img.dispatchEvent(new Event('load'));
  const link = img.closest('a')!;
  expect(link).not.toBeNull();
  return link;
}

function click(el: HTMLElement, init: MouseEventInit = {}, type = 'click'): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  el.dispatchEvent(event);
  return event;
}

// Observe the app's decision before cancelling the simulator's actual network navigation.
function nativeClick(link: HTMLAnchorElement, init: MouseEventInit, type = 'click'): void {
  let prevented: boolean | undefined;
  link.addEventListener(
    type,
    (e) => {
      prevented = e.defaultPrevented;
      e.preventDefault();
    },
    { once: true },
  );
  click(link, init, type);
  expect(prevented).toBe(false);
}

function checkLink(link: HTMLAnchorElement, url: string, title: string) {
  expect(link.getAttribute('href')).toBe(url);
  expect(link.target).toBe('_blank');
  expect(link.rel).toBe('noopener noreferrer');
  expect(link.title).toBe(title);
  expect(link.getAttribute('aria-label')).toBe(title);
}

it('opens loaded profile pictures in the media tab, including Shift splitting and native browser clicks', async () => {
  const picture = 'http://images.example/profile-full.jpg';
  const banner = 'https://images.example/banner-full.png';
  const x = profile(picture, banner);
  await settleAvatars();
  expect(x.el.querySelector('.phead a, .banner a')).toBeNull();
  const face = x.el.querySelector('.av.xl');
  const links = [
    [loaded(x.el, '.av.xl img'), picture, 'Alice · Profile picture'],
    [loaded(x.el, '.banner img'), banner, 'Alice · Profile banner'],
  ] as const;
  expect(x.el.querySelector('.av.xl')).toBe(face);
  const parent = vi.fn();
  x.el.addEventListener('click', parent);
  x.el.addEventListener('auxclick', parent);
  for (const [link, url, title] of links) {
    checkLink(link, url, title);
    for (const split of [false, true]) {
      expect(click(link, { shiftKey: split }).defaultPrevented).toBe(true);
      expect(x.env.open).toHaveBeenLastCalledWith(
        'media',
        { media: [{ type: 'image', url, alt: title }], index: 0, title },
        { split, from: link },
      );
    }
    for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
      nativeClick(link, modifiers);
    }
    nativeClick(link, { button: 1 }, 'auxclick');
  }
  expect(x.env.open).toHaveBeenCalledTimes(4);
  expect(parent).not.toHaveBeenCalled();
  // The source anchor must still exist when the media tab closes and the WM restores focus.
  x.el.hidden = true;
  await settleAvatars();
  expect(x.el.querySelector('.phead a')).toBe(links[0][0]);
  x.el.hidden = false;
  await settleAvatars();
  expect(x.el.querySelector('.phead a')).toBe(links[0][0]);
});

it.each([undefined, 'javascript:alert(1)', 'https://127.0.0.1/image.png'])(
  'keeps absent or blocked header pictures non-interactive (%s)',
  async (url) => {
    const x = profile(url, url);
    await settleAvatars();
    expect(x.el.querySelector('.phead a, .banner a')).toBeNull();
    expect(x.el.querySelector('.av.xl .faceletter')?.textContent).toBe('A');
    expect(x.el.querySelector('.av.xl img, .banner img')).toBeNull();
  },
);

it('does not link failed image requests or their placeholder on a redraw', async () => {
  const x = profile('https://images.example/broken-avatar', 'https://images.example/broken-banner');
  await settleAvatars();
  for (const selector of ['.av.xl img', '.banner img']) {
    const img = x.el.querySelector(selector)!;
    expect(img).not.toBeNull();
    img.dispatchEvent(new Event('error'));
  }
  expect(x.el.querySelector('.phead a, .banner a')).toBeNull();
  x.root.replaceChildren(renderProfile(x.model, x.env));
  await settleAvatars();
  expect(x.root.querySelector('.phead a, .banner a')).toBeNull();
});

it('uses hydrated and late metadata, replaces a changed URL, and removes an erased picture', async () => {
  const x = profile();
  await settleAvatars();
  const first = 'https://images.example/late-first';
  const second = 'https://images.example/late-second';
  learnPerson({ ...x.model.author, profileId: 'a', picture: first });
  await settleAvatars();
  const oldLink = loaded(x.el, '.av.xl img');
  checkLink(oldLink, first, 'Alice · Profile picture');
  learnPerson({ ...x.model.author, profileId: 'renamed', picture: first, name: 'Bea' });
  checkLink(oldLink, first, 'Bea · Profile picture');
  learnPerson({ ...x.model.author, profileId: 'b', picture: second });
  expect(x.el.querySelector('.phead a')).toBeNull();
  await settleAvatars();
  const link = loaded(x.el, '.av.xl img');
  checkLink(link, second, 'Alice · Profile picture');

  const banner = 'https://images.example/late-banner';
  const fresh = renderProfile({ ...x.model, banner }, x.env);
  x.root.replaceChildren(fresh);
  await settleAvatars();
  checkLink(loaded(fresh, '.av.xl img'), second, 'Alice · Profile picture');
  checkLink(loaded(fresh, '.banner img'), banner, 'Alice · Profile banner');
  learnPerson({ ...x.model.author, profileId: 'c' });
  expect(fresh.querySelector('.phead a')).toBeNull();
});

it('opens a reduced-motion still using the original address, not the derived object URL', async () => {
  const picture = 'https://images.example/still-source';
  const x = profile(picture);
  x.motion(true);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
  const link = loaded(x.el, '.av.xl img');
  expect(link.querySelector('img')?.src).toMatch(/^blob:/);
  checkLink(link, picture, 'Alice · Profile picture');
  x.motion(false);
  expect(x.el.querySelector('.phead a')).toBeNull();
});

it('does not make a reduced-motion uniform letter placeholder a link', async () => {
  const x = profile('https://images.example/uniform');
  x.motion(true);
  await settleAvatars();
  x.reply(x.wants()[0]!.req, { status: 'fallback', uniform: true });
  expect(x.el.querySelector('.phead a, .av.xl img, .av.xl canvas')).toBeNull();
});

it('removes a previously successful link if reloading the original fails', async () => {
  const x = profile('https://images.example/reload-failure');
  await settleAvatars();
  loaded(x.el, '.av.xl img');
  // A hidden profile keeps its loaded picture; only a remount asks for the original again.
  const parent = x.el.parentElement!;
  x.el.remove();
  await settleAvatars();
  parent.append(x.el);
  await settleAvatars();
  expect(x.el.querySelector('.phead a')).not.toBeNull();
  x.el.querySelector('.av.xl img')!.dispatchEvent(new Event('error'));
  expect(x.el.querySelector('.phead a')).toBeNull();
});

it('opens the channel header picture as media while channel list faces still open the channel', async () => {
  setLang('en');
  const x = avatarFixture();
  const { env, handlers } = setup();
  const picture = 'https://images.example/channel';
  const id = x.author().pubkey;
  const channel: ChannelRow = {
    kind: 'channel',
    id,
    key: id,
    bech32: id,
    name: 'Room',
    picture,
    about: '',
    joined: true,
    own: false,
    unread: 0,
  };
  const desk = mountChannelDesk({ env, slot: x.root });
  try {
    desk.seat(undefined, channel);
    await settleAvatars();
    x.reply(x.wants()[0]!.req, { status: 'ready', retained: true });
    const link = loaded(x.root, '.chead .av img');
    checkLink(link, picture, 'Room · Channel picture');
    expect(click(link).defaultPrevented).toBe(true);
    expect(env.open).toHaveBeenLastCalledWith(
      'media',
      {
        media: [{ type: 'image', url: picture, alt: 'Room · Channel picture' }],
        index: 0,
        title: 'Room · Channel picture',
      },
      { split: false, from: link },
    );
    desk.seat(undefined, { ...channel, picture: undefined });
    expect(x.root.querySelector('.chead a')).toBeNull();

    const list = document.createElement('div');
    x.root.append(list);
    const off = mountChannels(list, env);
    try {
      handlers().rows([channel], true, true);
      expect(list.querySelector('.chan .av a, .chan a')).toBeNull();
      click(list.querySelector('.chan .av')! as HTMLElement);
      expect(env.open).toHaveBeenLastCalledWith(
        'channel',
        { id, title: 'Room' },
        { split: false, background: false },
      );
    } finally {
      off();
    }
  } finally {
    desk.dispose();
  }
});
