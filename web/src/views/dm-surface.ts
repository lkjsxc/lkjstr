// Private surfaces release every body and subscription when their account authority changes.
import type { Account } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { openAccountUnlock } from './account-vault.ts';
import type { ViewEnv } from './registry.ts';

export const dmVisible = (env: ViewEnv): boolean =>
  env.visible.get() && document.visibilityState !== 'hidden';
export function mountDmSurface(
  el: HTMLElement,
  env: ViewEnv,
  mount: (account: Account) => () => void,
): () => void {
  let dispose: (() => void) | undefined,
    signature = '';
  el.classList.add('feed');
  el.tabIndex = -1;
  const draw = (): void => {
    const account = env.engine.accounts
      .get()
      .accounts.find((a) => a.author.pubkey === env.engine.me());
    const access = env.engine.dm?.access;
    const gate = access?.status(account) ?? 'unsupported';
    const next = `${account?.author.pubkey ?? ''}:${gate}`;
    if (next === signature) return;
    signature = next;
    dispose?.();
    dispose = undefined;
    el.replaceChildren();
    if (gate === 'ready' && account) {
      dispose = mount(account);
      return;
    }
    const line = h('div', { class: 'fstate muted' });
    const button = (
      key: 'bar.signedOut' | 'account.unlock' | 'dm.ask.go' | 'dm.retry',
      run: () => void,
    ): HTMLElement => h('button', { class: 'btn primary', onclick: run }, t(key));
    if (gate === 'signed-out') line.append(button('bar.signedOut', () => env.open('account')));
    else if (gate === 'read-only') line.textContent = t('dm.readonly');
    else if (gate === 'locked')
      line.append(
        h('div', null, t('dm.locked')),
        button('account.unlock', () => openAccountUnlock(env, account?.author.pubkey)),
      );
    else if (gate === 'ask')
      line.append(
        h('div', null, t('dm.ask')),
        button('dm.ask.go', () => account && access?.allow(account.author.pubkey)),
      );
    else if (gate === 'refused' || gate === 'timeout')
      line.append(
        h('div', null, t(gate === 'timeout' ? 'dm.fail.timeout' : 'dm.refused')),
        button('dm.retry', () => account && access?.retry(account.author.pubkey)),
      );
    else line.textContent = t(env.engine.dm ? 'dm.signerOld' : 'dm.unsupported');
    el.append(line);
  };
  const offs = [env.engine.accounts.subscribe(draw), env.engine.info.subscribe(draw)];
  if (env.engine.dm) offs.push(env.engine.dm.access.changed.subscribe(draw));
  draw();
  return () => {
    offs.forEach((off) => off());
    dispose?.();
    el.replaceChildren();
  };
}
