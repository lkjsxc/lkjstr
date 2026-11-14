// The rows that are not notes: a profile's header, a person in a list, a notification.
import type { NotificationRow, PersonRow, ProfileRow } from '../engine/protocol.ts';
import { countText, dayOf, fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { renderNote } from './note.ts';
import { act } from './note-actions.ts';
import {
  avatar,
  copy,
  displayName,
  emojiImg,
  how,
  nameButton,
  plainName,
  segments,
} from './parts.ts';
import type { ViewEnv } from './registry.ts';

function followButton(env: ViewEnv, pubkey: string, followed: boolean): HTMLElement {
  return h(
    'button',
    {
      class: followed ? 'btn' : 'btn primary',
      onclick: (e) => (
        e.stopPropagation(), void act(env, (as) => ({ a: 'follow', as, pubkey, on: !followed }))
      ),
    },
    t(followed ? 'profile.unfollow' : 'profile.follow'),
  );
}

/** The header of a profile. It is the first row of the list, so it scrolls away with the notes. */
export function renderProfile(row: ProfileRow, env: ViewEnv): HTMLElement {
  const a = row.author;
  const lang = getLang();
  const stat = (kind: string | null, n: number, label: Key): HTMLElement => {
    const inner = [h('b', null, countText(n, row.partial, lang)), ' ', t(label)];
    return kind
      ? h(
          'button',
          {
            class: 'stat',
            onclick: (e) =>
              env.open(
                kind,
                { pubkey: a.pubkey, title: `${plainName(a)} · ${t(label)}` },
                how(e as MouseEvent),
              ),
          },
          inner,
        )
      : h('span', { class: 'stat' }, inner);
  };
  const known = row.knownFollowers;
  return h(
    'section',
    { class: 'profile' },
    h('div', {
      class: 'banner',
      style: row.banner ? `background-image:url("${row.banner}")` : null,
    }),
    h(
      'div',
      { class: 'phead' },
      avatar(a, 'av xl'),
      h(
        'div',
        { class: 'pbtns' },
        row.followsYou ? h('span', { class: 'badge' }, t('profile.followsYou')) : null,
        row.self ? null : followButton(env, a.pubkey, row.followed),
      ),
    ),
    h(
      'h1',
      { class: 'pname' },
      displayName(a),
      a.bot ? h('span', { class: 'badge' }, t('note.bot')) : null,
    ),
    a.nip05
      ? h(
          'div',
          { class: a.verified ? 'nip ok' : 'nip' },
          a.verified ? icon('check') : null,
          a.nip05,
        )
      : null,
    h(
      'button',
      { class: 'npub', title: t('profile.copyNpub'), onclick: () => void copy(env, a.npub) },
      a.npub,
    ),
    row.muted ? h('div', { class: 'muted' }, t('profile.muted')) : null,
    h('div', { class: 'about' }, segments(row.about, env)),
    h(
      'div',
      { class: 'pmeta muted' },
      row.website
        ? h(
            'a',
            { href: row.website, target: '_blank', rel: 'noopener noreferrer', title: row.website },
            row.website.replace(/^https?:\/\//, ''),
          )
        : null,
      row.lud16 ? h('span', null, icon('zap'), row.lud16) : null,
      row.since ? h('span', null, t('profile.since', { date: dayOf(row.since) })) : null,
    ),
    h(
      'div',
      { class: 'pstats' },
      stat('following', row.following, 'profile.following'),
      stat('followers', row.followers, 'profile.followers'),
      stat(null, row.notes, 'profile.notes'),
    ),
    known
      ? h(
          'div',
          { class: 'known muted' },
          known.actors.map((k) => avatar(k, 'av xs')),
          h(
            'span',
            null,
            t('profile.known', {
              names:
                known.actors.map(plainName).join(t('list.sep')) +
                (known.others ? t('ctx.others', { n: known.others }) : ''),
            }),
          ),
        )
      : null,
  );
}

export function renderPerson(row: PersonRow, env: ViewEnv): HTMLElement {
  const el = h(
    'div',
    { class: 'person' },
    avatar(row.author),
    h(
      'div',
      { class: 'pmain' },
      h(
        'div',
        { class: 'nhead' },
        nameButton(row.author, env),
        row.followsYou ? h('span', { class: 'badge' }, t('profile.followsYou')) : null,
      ),
      h('div', { class: 'muted clip' }, row.about),
    ),
    row.self ? null : followButton(env, row.author.pubkey, row.followed),
  );
  el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('button')) return;
    env.open('profile', { pubkey: row.author.pubkey, title: plainName(row.author) }, how(e));
  });
  return el;
}

/** "A and B reacted to your note": each person opens their profile, the excerpt opens the reader's note. */
export function renderNotification(row: NotificationRow, env: ViewEnv): HTMLElement {
  if (row.note && (row.type === 'mention' || row.type === 'reply')) {
    const el = renderNote(row.note, env);
    if (row.unread) el.classList.add('unread');
    return el;
  }
  const names = row.actors
    .slice(0, 2)
    .flatMap((a, i) => [i ? t('list.sep') : '', nameButton(a, env)]);
  const rest = row.others + Math.max(0, row.actors.length - 2);
  const mark =
    row.type === 'reaction' && row.emoji
      ? row.emoji.url
        ? emojiImg(row.emoji.emoji, row.emoji.url)
        : row.emoji.emoji
      : icon(row.type === 'repost' ? 'repost' : row.type === 'zap' ? 'zap' : 'user');
  const target = row.target;
  return h(
    'div',
    { class: row.unread ? 'notif unread' : 'notif' },
    h('span', { class: `nmark k-${row.type}` }, mark),
    h(
      'div',
      { class: 'nmain' },
      h(
        'div',
        { class: 'nfaces' },
        row.actors.slice(0, 6).map((a) => avatar(a, 'av sm')),
        h(
          'time',
          { title: fullTime(row.at) },
          noteTime(row.at, Date.now(), {
            relative: env.settings.get().relativeTime,
            lang: getLang(),
          }),
        ),
      ),
      h(
        'div',
        null,
        names,
        rest ? t('ctx.others', { n: rest }) : '',
        t(`notif.${row.type}` as Key, { sats: row.sats ?? 0 }),
      ),
      row.comment ? h('div', { class: 'text' }, row.comment) : null,
      target
        ? h(
            'button',
            {
              class: 'excerpt muted clip',
              onclick: (e) => env.open('thread', { id: target.id }, how(e as MouseEvent)),
            },
            target.excerpt,
          )
        : null,
    ),
  );
}
