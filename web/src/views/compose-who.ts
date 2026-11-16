// Who is posting, at the left of the composer's bar: the active account as a button that switches accounts. A
// read-only account says so here, before anything is typed; signed out, the bar offers Sign in where Post would be.
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { learnPerson } from '../shared/people.ts';
import { openMenu } from '../wm/menus.ts';
import { ability } from './can.ts';
import { avatar, displayName, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type Who = {
  /** The account button (empty when signed out). */
  readonly el: HTMLElement;
  /** Shown in place of Post while nobody is signed in. */
  readonly signIn: HTMLElement;
  dispose(): void;
};

export function createWho(env: ViewEnv, changed: () => void): Who {
  const el: HTMLElement = h('button', { class: 'cwho' });
  const signIn = h(
    'button',
    { class: 'btn primary', onclick: () => env.open('account') },
    t('bar.signedOut'),
  );
  el.addEventListener('click', () => {
    const a = env.engine.accounts.get();
    openMenu(env.layer, el, [
      ...a.accounts.map((x) => ({
        label: `${x.author.pubkey === a.active ? '✓ ' : ''}${plainName(x.author)}`,
        run: () => void env.engine.act({ a: 'account.use', pubkey: x.author.pubkey }),
      })),
      { label: t('view.account'), run: () => env.open('account') },
    ]);
  });
  let signature = '';
  const draw = (): void => {
    const a = env.engine.accounts.get();
    const me = a.accounts.find((x) => x.author.pubkey === a.active);
    const can = ability(env.engine);
    el.hidden = can === 'signed-out';
    signIn.hidden = !el.hidden;
    el.title = t('compose.as', { name: me ? plainName(me.author) : '' });
    if (me) learnPerson(me.author);
    const next = JSON.stringify([me?.author.pubkey, can]);
    if (next !== signature)
      replaceChildren(
        el,
        me
          ? [avatar(me.author, 'av sm'), h('span', { class: 'clip' }, displayName(me.author))]
          : null,
        can === 'read-only' || can === 'locked'
          ? h(
              'span',
              { class: 'badge warn' },
              t(can === 'locked' ? 'account.signer.locked' : 'account.signer.none'),
            )
          : null,
      );
    if (me && next === signature) {
      const name = el.querySelector('.clip');
      if (name) replaceChildren(name, displayName(me.author));
    }
    signature = next;
    changed();
  };
  const offs = [env.engine.accounts.subscribe(draw), env.engine.info.subscribe(draw)];
  draw();
  return { el, signIn, dispose: () => offs.forEach((off) => off()) };
}
