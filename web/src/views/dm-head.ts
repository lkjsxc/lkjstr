// The conversation head opens people, and extends the participant set through the existing directory picker.
import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { openMenu, openPopover } from '../wm/menus.ts';
import { createDmFind } from './dm-find.ts';
import { dmAuthor, dmNames, openMessage } from './dm-parts.ts';
import { faceButton, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function createDmHead(env: ViewEnv, account: string, peers: readonly string[]) {
  const el = h('div', { class: 'chead dm-head' });
  let people: ReadonlyMap<string, Author> = new Map(),
    signature = '',
    closePicker: (() => void) | undefined;
  const more = h(
    'button',
    { class: 'icon', title: t('act.more'), 'aria-label': t('act.more') },
    icon('more'),
  );
  const add = (): void => {
    const find = createDmFind({
      env,
      exclude: () => new Set([account, ...peers]),
      choose(author, event) {
        closePicker?.();
        const next = [...peers, author.pubkey],
          names = new Map(people);
        names.set(author.pubkey, author);
        openMessage(env, next, dmNames(next, names), event);
      },
    });
    const panel = h(
      'div',
      { class: 'dm-picker' },
      h('div', { class: 'muted' }, t('dm.addPerson.hint')),
      find.input,
      find.results,
    );
    closePicker = openPopover(env.layer, more, panel, {
      closed: () => {
        find.dispose();
        closePicker = undefined;
      },
    });
    find.input.focus();
  };
  more.addEventListener('click', () =>
    openMenu(env.layer, more, [
      {
        label: t(peers.length >= 31 ? 'dm.full' : 'dm.addPerson'),
        disabled: peers.length >= 31,
        run: add,
      },
    ]),
  );
  return {
    el,
    update(next: ReadonlyMap<string, Author>): void {
      people = next;
      const sig = JSON.stringify(peers.map((key) => dmAuthor(people, key)));
      if (sig === signature) return;
      signature = sig;
      const faces = h(
        'div',
        { class: 'dm-head-faces' },
        peers.map((key) => faceButton(dmAuthor(people, key), env)),
      );
      const names = h(
        'div',
        { class: 'pmain pname' },
        peers.flatMap((key, i) => [i ? t('list.sep') : '', nameButton(dmAuthor(people, key), env)]),
        peers.length > 1
          ? h('span', { class: 'dm-count faint' }, t('dm.people', { n: peers.length + 1 }))
          : null,
      );
      el.replaceChildren(faces, names, more);
      env.setTitle(dmNames(peers, people));
    },
    dispose(): void {
      closePicker?.();
      el.replaceChildren();
      people = new Map();
    },
  };
}
