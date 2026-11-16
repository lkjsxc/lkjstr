// The rows that are not notes: a profile's header, a person in a list, a notification.
import type { NotificationRow, PersonRow, ProfileRow } from '../engine/protocol.ts';
import { countText, dayOf, fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { reactionLabel } from '../shared/reactions.ts';
import { openMenu } from '../wm/menus.ts';
import { ability, abilityText } from './can.ts';
import { renderNote } from './note.ts';
import { act } from './note-actions.ts';
import {
  avatar,
  copy,
  displayName,
  emojiImg,
  faceButton,
  how,
  nameButton,
  plainName,
  segments,
  unnamed,
} from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { openTheirHome, theirHomeButton } from './their-home.ts';

function followButton(env: ViewEnv, pubkey: string, followed: boolean): HTMLElement {
  // Signed out or read-only, the button is drawn off; a press says why (`act`).
  const can = ability(env.engine);
  return h(
    'button',
    {
      class: can !== 'ok' ? 'btn off' : followed ? 'btn' : 'btn primary',
      'aria-disabled': can !== 'ok' ? true : null,
      title: can !== 'ok' ? abilityText(can) : null,
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
  // A count is shown once it is known. Absent, or a lower bound of nothing ("0+"), is not a count: the label
  // stands alone (it still opens the list) and the number takes its place when it arrives.
  const stat = (kind: string | null, n: number | undefined, label: Key): HTMLElement | null => {
    const partial = kind === 'following' || kind === 'followers' ? false : row.partial;
    const known = typeof n === 'number' && !(n === 0 && partial);
    if (!known && !kind) return null;
    const inner = known ? [h('b', null, countText(n, partial, lang)), ' ', t(label)] : [t(label)];
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
    { class: unnamed(a) ? 'profile pending' : 'profile' },
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
        (env.engine.info.get()?.version ?? 0) >= 5
          ? h(
              'button',
              {
                class: 'icon',
                'aria-label': t('act.more'),
                onclick: (e) =>
                  openMenu(env.layer, e.currentTarget as HTMLElement, [
                    { label: t('home.openTheirs'), run: () => openTheirHome(env, a) },
                  ]),
              },
              icon('more'),
            )
          : null,
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
    a.npub
      ? h(
          'button',
          { class: 'npub', title: t('profile.copyNpub'), onclick: () => void copy(env, a.npub) },
          a.npub,
        )
      : null,
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
      theirHomeButton(env, a),
    ),
    known
      ? h(
          'div',
          { class: 'known muted' },
          known.actors.map((k) => faceButton(k, env, 'av xs')),
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
    faceButton(row.author, env),
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

/** "A and B reacted to your note": each person opens their profile; a press anywhere else opens what the news
 * is about, as on a note. */
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
      ? row.emoji.url && row.emoji.emoji.startsWith(':')
        ? emojiImg(row.emoji.emoji, row.emoji.url)
        : reactionLabel(row.emoji.emoji)
      : icon(row.type === 'repost' ? 'repost' : row.type === 'zap' ? 'zap' : 'user');
  const target = row.target;
  const first = row.actors[0];
  const go = (e: MouseEvent): void => {
    if (String(getSelection())) return; // selecting text is not a press
    if (target) env.open('thread', { id: target.id }, how(e));
    else if (first) env.open('profile', { pubkey: first.pubkey, title: plainName(first) }, how(e));
  };
  const plain = (e: Event): boolean => !(e.target as Element).closest('button, a');
  const el = h(
    'div',
    { class: row.unread ? 'notif unread' : 'notif' },
    h('span', { class: `nmark k-${row.type}` }, mark),
    h(
      'div',
      { class: 'nmain' },
      h(
        'div',
        { class: 'nfaces' },
        row.actors.slice(0, 6).map((a) => faceButton(a, env, 'av sm')),
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
  el.addEventListener('click', (e) => void (plain(e) && go(e)));
  el.addEventListener('mousedown', (e) => void (e.button === 1 && plain(e) && e.preventDefault()));
  el.addEventListener('auxclick', (e) => void (e.button === 1 && plain(e) && go(e)));
  return el;
}
