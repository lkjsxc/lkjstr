// The top bar: the name, the workspace chips, and at the right the composer and the account. The number of
// connected relays shows only when the setting asks for it.
import type { Engine } from '../engine/client.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import type { SettingsStore } from '../shared/settings.ts';
import { avatar, plainName } from '../views/parts.ts';
import { openMenu } from '../wm/menus.ts';

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
  const menu = (): void => {
    const a = o.engine.accounts.get();
    openMenu(o.layer, account, [
      ...a.accounts.map((x) => ({
        label: `${x.author.pubkey === a.active ? '✓ ' : ''}${plainName(x.author)}`,
        run: () => void o.engine.act({ a: 'account.use', pubkey: x.author.pubkey }),
      })),
      ...(['settings', 'relays', 'shortcuts', 'about'] as const).map((kind) => ({
        label: t(`view.${kind}`),
        run: () => o.open(kind),
      })),
    ]);
  };
  account.addEventListener('click', menu);
  const render = (): void => {
    const a = o.engine.accounts.get();
    const me = a.accounts.find((x) => x.author.pubkey === a.active);
    const s = o.engine.status.get();
    relays.hidden = !o.settings.get().showRelayCount;
    relays.textContent = t('bar.relays', { n: s.connected, all: s.wanted });
    relays.title = t('view.relays');
    account.title = me ? plainName(me.author) : t('bar.account');
    account.setAttribute('aria-label', t('bar.account'));
    replaceChildren(account, me ? avatar(me.author, 'av sm') : t('bar.signedOut'));
    compose.title = t('view.compose');
    compose.setAttribute('aria-label', t('view.compose'));
  };
  const compose = h('button', { class: 'icon', onclick: () => o.open('compose') }, icon('pen'));
  bar.replaceChildren(
    h('span', { class: 'brand' }, 'lkjstr'),
    o.spaces,
    h('span', { class: 'grow' }),
    relays,
    compose,
    account,
  );
  const offs = [
    o.engine.accounts.subscribe(render),
    o.engine.status.subscribe(render),
    o.settings.subscribe(render),
  ];
  render();
  return { render, dispose: () => offs.forEach((off) => off()) };
}
