// M1: a bounded inbox list. Filtering matches people, never private message text.
import type { Account, DmConversation, DmSnapshot } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { createDmFind } from './dm-find.ts';
import { dmEnd, dmFaces, dmNames, dmPeople, inboxSetup, openMessage } from './dm-parts.ts';
import { dmSubscription } from './dm-subscription.ts';
import { dmVisible, mountDmSurface } from './dm-surface.ts';
import { type Keyed, reconcile } from './lists.ts';
import type { ViewEnv } from './registry.ts';

export function mountMessages(el: HTMLElement, env: ViewEnv): () => void {
  return mountDmSurface(el, env, (account) => mountList(el, env, account));
}
function mountList(el: HTMLElement, env: ViewEnv, account: Account): () => void {
  let snapshot: DmSnapshot | undefined,
    text = '',
    older = false,
    stopped = false,
    noInbox = account.inbox?.length === 0;
  let subscription: ReturnType<typeof dmSubscription> | undefined;
  const list = h('div', { class: 'list' }),
    setup = h('div'),
    end = h('div');
  let peopleSignature = '',
    lastAutomatic = '';
  let moreFrame = 0;
  const cache: Keyed = new Map(); // <=200 conversation rows
  const people = () => dmPeople(snapshot, account);
  const others = (c: DmConversation) =>
    c.participants.filter((key) => key !== account.author.pubkey);
  const conversations = (): readonly DmConversation[] =>
    (snapshot?.conversations ?? []).filter((c) => others(c).length > 0);
  const matched = (): readonly DmConversation[] => {
    const words = text.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return conversations().filter((c) =>
      words.every((word) => dmNames(others(c), people()).toLocaleLowerCase().includes(word)),
    );
  };
  const choose = (c: DmConversation, event?: MouseEvent): void =>
    openMessage(env, others(c), dmNames(others(c), people()), event);
  const finder = createDmFind({
    env,
    exclude: () =>
      new Set([
        account.author.pubkey,
        ...conversations()
          .filter((c) => others(c).length === 1)
          .flatMap(others),
      ]),
    choose: (author, event) =>
      openMessage(
        env,
        [author.pubkey],
        dmNames([author.pubkey], new Map([[author.pubkey, author]])),
        event,
      ),
    changed(value) {
      text = value;
      draw();
    },
    first() {
      const first = matched()[0];
      if (!first) return false;
      choose(first);
      return true;
    },
  });
  const render = (conversation: DmConversation): HTMLElement => {
    const peers = others(conversation),
      names = dmNames(peers, people());
    const recent = conversation.recentAuthors ?? [conversation.last.author];
    const faces = [...new Set([...recent, ...peers])]
      .filter((key) => peers.includes(key))
      .slice(0, peers.length > 1 ? 2 : 1);
    const row = h(
      'div',
      {
        class: conversation.unread ? 'chan unread' : 'chan',
        tabindex: 0,
        role: 'link',
        'data-f': 'open',
      },
      dmFaces(faces, people(), env),
      h(
        'div',
        { class: 'pmain' },
        h(
          'div',
          { class: 'name clip' },
          names,
          peers.length > 1
            ? h(
                'span',
                { class: 'faint dm-count' },
                t('dm.people', { n: conversation.participants.length }),
              )
            : null,
        ),
        h(
          'div',
          { class: 'muted clip' },
          conversation.last.author === account.author.pubkey
            ? t('dm.you', { text: conversation.last.text })
            : conversation.last.text,
        ),
      ),
      h(
        'div',
        { class: 'cside' },
        h(
          'time',
          { title: fullTime(conversation.last.at) },
          noteTime(conversation.last.at, Date.now(), {
            relative: env.settings.get().relativeTime,
            lang: getLang(),
          }),
        ),
        conversation.unread
          ? h(
              'span',
              { class: 'cnew', 'aria-label': t('dm.unread', { n: conversation.unread }) },
              conversation.unread,
            )
          : null,
      ),
    );
    row.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('button')) choose(conversation, event);
    });
    row.addEventListener('auxclick', (event) => {
      if (event.button === 1 && !(event.target as Element).closest('button')) {
        event.preventDefault();
        choose(conversation, event);
      }
    });
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target === row) {
        event.preventDefault();
        choose(conversation);
      }
    });
    return row;
  };
  function draw(): void {
    if (stopped) return;
    const current = env.engine.accounts
      .get()
      .accounts.find((a) => a.author.pubkey === account.author.pubkey);
    if (current?.inbox !== undefined) noInbox = current.inbox.length === 0;
    else if (snapshot?.phase === 'unsupported' && snapshot.error === 'not-found') noInbox = true;
    else if (snapshot?.phase === 'live' && !snapshot.error) noInbox = false;
    setup.replaceChildren(...(noInbox ? [inboxSetup(env)] : []));
    const signature = JSON.stringify([...people().values()]);
    if (peopleSignature !== signature) {
      peopleSignature = signature;
      cache.clear();
    }
    reconcile(list, cache, matched(), render);
    finder.refresh();
    rule.hidden = !text.trim() || !finder.count();
    end.replaceChildren(
      text.trim() && !finder.pending() && !matched().length && !finder.count()
        ? h('div', { class: 'fstate muted' }, t('dm.none'))
        : dmEnd(snapshot, conversations().length, older, open, true),
    );
    cancelAnimationFrame(moreFrame);
    moreFrame = requestAnimationFrame(() => requestMore(true));
  }
  const open = (): void => {
    subscription?.close();
    snapshot = undefined;
    older = false;
    lastAutomatic = '';
    cache.clear();
    draw();
    subscription = dmSubscription(env, { account: account.author.pubkey }, (value) => {
      snapshot = value;
      older = false;
      draw();
    });
  };
  const requestMore = (automatic: boolean): void => {
    if (
      stopped ||
      !subscription ||
      !dmVisible(env) ||
      older ||
      !snapshot?.more ||
      snapshot.phase === 'loading' ||
      snapshot.phase === 'failed' ||
      snapshot.phase === 'unsupported' ||
      snapshot.conversations.length >= 200 ||
      text.trim() ||
      el.scrollHeight - el.scrollTop - el.clientHeight > 160
    )
      return;
    const stamp = snapshot.conversations.map((row) => row.last.id).join(':') || 'empty';
    if (automatic && lastAutomatic === stamp) return;
    lastAutomatic = stamp;
    older = true;
    draw();
    subscription.more();
  };
  const more = (): void => requestMore(false);
  const visible = (): void => requestMore(true);
  const rule = h('div', { class: 'dm-rule', hidden: true });
  el.classList.add('chans');
  el.replaceChildren(
    h(
      'div',
      { class: 'fslot' },
      h('div', { class: 'fbar' }, h('div', { class: 'rbar' }, finder.input)),
      setup,
    ),
    list,
    rule,
    finder.results,
    end,
  );
  el.addEventListener('scroll', more, { passive: true });
  document.addEventListener('visibilitychange', visible);
  const offs = [
    env.settings.subscribe(() => {
      cache.clear();
      draw();
    }),
    env.engine.accounts.subscribe(draw),
    env.visible.subscribe(visible),
  ];
  open();
  return () => {
    stopped = true;
    cancelAnimationFrame(moreFrame);
    document.removeEventListener('visibilitychange', visible);
    subscription?.close();
    finder.dispose();
    offs.forEach((off) => off());
    el.removeEventListener('scroll', more);
    cache.clear();
    snapshot = undefined;
    list.replaceChildren();
  };
}
