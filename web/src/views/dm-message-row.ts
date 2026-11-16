// A private row uses the ordinary note rhythm without public actions or persistent body state.
import type { Author, DmMessage } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { openMenu } from '../wm/menus.ts';
import { dmAuthor } from './dm-parts.ts';
import { copy, faceButton, nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function renderDmMessage(o: {
  message: DmMessage;
  below?: DmMessage;
  grouped: boolean;
  people: ReadonlyMap<string, Author>;
  env: ViewEnv;
  reply(message: DmMessage): void;
  jump(id: string): void;
  known(id: string): DmMessage | undefined;
  folded: Set<string>;
}): HTMLElement {
  const { message: m, env } = o,
    author = dmAuthor(o.people, m.author);
  const reply = h(
    'button',
    {
      class: 'icon',
      title: t('compose.reply'),
      'aria-label': t('compose.reply'),
      onclick: () => o.reply(m),
    },
    icon('reply'),
  );
  const more = h(
    'button',
    { class: 'icon', title: t('act.more'), 'aria-label': t('act.more') },
    icon('more'),
  );
  more.addEventListener('click', () =>
    openMenu(env.layer, more, [{ label: t('dm.copy'), run: () => void copy(env, m.text) }]),
  );
  const head = h(
    'div',
    { class: 'nhead' },
    o.grouped ? null : nameButton(author, env),
    o.grouped
      ? null
      : h(
          'time',
          { title: fullTime(m.at) },
          noteTime(m.at, Date.now(), {
            relative: env.settings.get().relativeTime,
            lang: getLang(),
          }),
        ),
    m.legacy
      ? h('span', { class: 'faint dm-legacy', title: t('dm.legacy.tip') }, t('dm.legacy'))
      : null,
    h('span', { class: 'dm-tools faint' }, reply, more),
  );
  const text = h(
    'div',
    { class: o.folded.has(m.id) ? 'text open' : 'text' },
    m.segments ? segments(m.segments, env) : m.text,
  );
  const content = h('div', { class: 'content' }, text);
  const main = h('div', { class: 'nmain' });
  if (m.replyTo) {
    const known = o.known(m.replyTo),
      ref =
        m.reply ??
        (known
          ? { id: known.id, author: known.author, excerpt: known.text.split('\n')[0] ?? '' }
          : undefined);
    main.append(
      h(
        'button',
        {
          class: 'ctx dm-in-reply faint clip',
          disabled: !ref,
          onclick: () => o.jump(m.replyTo ?? ''),
        },
        ref
          ? `${t('dm.inReply', { name: plainName(dmAuthor(o.people, ref.author)) })} ${ref.excerpt.split('\n')[0] ?? ''}`
          : t('dm.replyGone'),
      ),
    );
  }
  main.append(head);
  if (m.subject !== null && m.subject !== o.below?.subject)
    main.append(h('div', { class: 'dm-subject' }, m.subject));
  main.append(content);
  const node = h(
    'div',
    {
      class: `note dm-note${m.unread ? ' unread' : ''}${o.grouped ? ' grouped' : ''}`,
      title: o.grouped ? fullTime(m.at) : undefined,
      'data-key': m.id,
      'data-note': m.id,
    },
    h('div', { class: 'nrow' }, o.grouped ? h('span') : faceButton(author, env), main),
  );
  requestAnimationFrame(() => {
    if (!text.isConnected || o.folded.has(m.id) || text.scrollHeight <= text.clientHeight + 2)
      return;
    const button = h('button', { class: 'lnk fold' }, t('note.more'));
    button.addEventListener('click', () => {
      o.folded.add(m.id);
      text.classList.add('open');
      content.classList.remove('folded');
      button.remove();
    });
    content.classList.add('folded');
    text.after(button);
  });
  return node;
}
