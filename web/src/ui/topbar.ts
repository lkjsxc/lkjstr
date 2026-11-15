// The top bar: the name (a menu of the tabs about lkjstr itself: Settings, Relays, Stats, Docs), the workspace chips, and at the right the
// composer and the account. Signed out, the account is one button that opens the sign-in tab; signed in, it is the
// active account's face and a menu of what is the reader's own: their profile, the other accounts to switch to,
// and the Accounts tab. Everything else is reached from the name. The relay count shows only when asked for.
import type { Engine } from '../engine/client.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import type { SettingsStore } from '../shared/settings.ts';
import { avatar, plainName } from '../views/parts.ts';
import { type MenuItem, openMenu } from '../wm/menus.ts';

export type TopBar = { render(): void; dispose(): void };
export function createTopBar(
  bar: HTMLElement,
  o: {
    engine: Engine;
    settings: SettingsStore;
    spaces: HTMLElement;
    layer: HTMLElement;
    open(kind: string, state?: object): void;
  },
): TopBar {
  const relays = h('button', { class: 'relays muted', onclick: () => o.open('relays') });
  const account: HTMLElement = h('button', { class: 'acct' });
  const pages = (...kinds: ('account' | 'settings' | 'relays' | 'stats' | 'docs')[]) =>
    kinds.map((kind) => ({ label: t(`view.${kind}`), run: () => o.open(kind) }));
  const brand: HTMLElement = h('button', { class: 'brand' }, 'lkjstr');
  brand.addEventListener('click', () =>
    openMenu(o.layer, brand, pages('settings', 'relays', 'stats', 'docs')),
  );
  account.addEventListener('click', () => {
    const a = o.engine.accounts.get();
    if (!a.active) return o.open('account');
    const me = a.accounts.find((x) => x.author.pubkey === a.active);
    const others = a.accounts.filter((x) => x.author.pubkey !== a.active);
    openMenu(o.layer, account, [
      ...(me
        ? [
            {
              label: plainName(me.author),
              sub: t('view.profile'),
              lead: avatar(me.author, 'av'),
              run: () =>
                o.open('profile', { pubkey: me.author.pubkey, title: plainName(me.author) }),
            },
          ]
        : []),
      ...others.map((x, i) => ({
        label: `${plainName(x.author)}${x.signer === 'none' ? ` (${t('account.signer.none')})` : ''}`,
        lead: avatar(x.author, 'av sm'),
        sep: i === 0,
        run: () => void o.engine.act({ a: 'account.use', pubkey: x.author.pubkey }),
      })),
      { ...pages('account')[0], sep: true } as MenuItem,
    ]);
  });
  let faceSig = '';
  const render = (): void => {
    const a = o.engine.accounts.get();
    const me = a.accounts.find((x) => x.author.pubkey === a.active);
    const s = o.engine.status.get();
    relays.hidden = !o.settings.get().showRelayCount;
    relays.textContent = t('bar.relays', { n: s.connected, all: s.wanted });
    relays.title = t('view.relays');
    // Signed in, the face is there from the first frame (the account is remembered), also before its name is.
    const face = me?.author ?? (a.active ? { pubkey: a.active, npub: '', name: '' } : undefined);
    account.className = face ? 'acct' : 'acct out';
    account.title = me ? plainName(me.author) : t(face ? 'bar.account' : 'bar.signedOut');
    account.setAttribute('aria-label', t(face ? 'bar.account' : 'bar.signedOut'));
    const nextFace = JSON.stringify([face?.pubkey, !!face, me?.signer === 'none']);
    if (nextFace !== faceSig)
      replaceChildren(
        account,
        face ? avatar(face, 'av sm') : t('bar.signedOut'),
        me?.signer === 'none' ? h('span', { class: 'ro', title: t('error.read-only') }) : null,
      );
    faceSig = nextFace;
    compose.hidden = !a.active; // a visitor cannot post: the bar offers the way in instead
    compose.title = t('view.compose');
    compose.setAttribute('aria-label', t('view.compose'));
  };
  const compose = h('button', { class: 'icon', onclick: () => o.open('compose') }, icon('pen'));
  bar.replaceChildren(brand, o.spaces, h('span', { class: 'grow' }), relays, compose, account);
  const offs = [
    o.engine.accounts.subscribe(render),
    o.engine.status.subscribe(render),
    o.settings.subscribe(render),
  ];
  render();
  return { render, dispose: () => offs.forEach((off) => off()) };
}
