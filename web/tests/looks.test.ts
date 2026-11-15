import { afterEach, expect, it } from 'vitest';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { EngineStats } from '../src/engine/protocol.ts';
import { clockOf, fullTime } from '../src/shared/format.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { loadViewState } from '../src/shared/view-state.ts';
import { createRowList } from '../src/views/feed-draw.ts';
import { hasDaySeparators } from '../src/views/feed-sources.ts';
import { disposeLinkCards, linkCards } from '../src/views/link-cards.ts';
import { actionRow, reactionChips } from '../src/views/note-actions.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { mountStats } from '../src/views/stats.ts';
import { tabHits } from '../src/wm/tab-search.ts';

afterEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});
const world = createWorld(1_800_000_000_000);
const row = () => noteRow(world, world.notes[0]!, { me: '' });
const env = () =>
  ({
    instance: 'looks',
    settings: createSettings(),
    engine: { accounts: createSignal({ accounts: [] }) },
  }) as unknown as ViewEnv;

it('dated rows keep only the clock through author/count patches; undated rows keep the date', () => {
  const note = { ...row(), at: Date.now() - 2 * 86_400_000, repostedBy: undefined };
  const list = document.createElement('div');
  document.body.append(list);
  let separated = true;
  const dated = createRowList(list, env(), () => separated);
  dated.draw([note]);
  expect(list.querySelector('time')?.textContent).toBe(clockOf(note.at));
  expect(list.querySelector('time')?.title).toBe(fullTime(note.at));
  dated.draw([{ ...note, author: { ...note.author, name: 'FourteenLetter' } }]);
  expect(list.querySelector('time')?.textContent).toBe(clockOf(note.at));
  separated = false;
  dated.draw([note]);
  expect(list.querySelector('time')?.textContent).toContain(fullTime(note.at).slice(0, 10));
  expect(list.querySelector('.day')).toBeNull();
  for (const kind of ['search', 'bookmarks', 'thread']) expect(hasDaySeparators(kind)).toBe(false);
  expect(hasDaySeparators('profile', 'reactions')).toBe(false);
  expect(hasDaySeparators('profile', 'reposts')).toBe(false);
  dated.dispose();
  const undated = createRowList(list, env(), false);
  undated.draw([note]);
  expect(list.querySelector('time')?.textContent).toContain(fullTime(note.at).slice(0, 10));
  undated.dispose();
});

it('draws each page once and closes failed or untitled preview slots', () => {
  const card = {
    source: 'https://example.test/story',
    url: 'https://example.test/story',
    kind: 'page' as const,
    title: 'Story',
  };
  const cards = linkCards([card, card]);
  expect(cards).toHaveLength(1);
  const root = document.createElement('div');
  root.append(...cards);
  disposeLinkCards(root);
  expect(linkCards([{ ...card, kind: 'link', title: '/story' }])).toHaveLength(0);
  expect(linkCards([{ ...card, title: undefined }])).toHaveLength(0);
  expect(linkCards([{ ...card, title: '  ' }])).toHaveLength(0);
  expect(linkCards([{ ...card, title: undefined, kind: 'loading' }])).toHaveLength(1);
});

it('prints reactions once, with a suffix only on the number that reports a lower bound', () => {
  const note = {
    ...row(),
    reactions: [{ emoji: '+', count: 3, mine: false }],
    counts: { ...row().counts, reactions: 3, partial: false },
  };
  expect(actionRow(note, env()).querySelector('.a-heart > span')?.textContent).toBe('');
  expect(reactionChips(note, env())?.textContent).toBe('❤️3');
  expect(
    reactionChips({ ...note, counts: { ...note.counts, partial: true } }, env())?.textContent,
  ).toBe('❤️3+');
  expect(
    actionRow({ ...note, reactions: [] }, env()).querySelector('.a-heart > span')?.textContent,
  ).toBe('3');
});

it('empty tab search omits current-tile kinds while typing still finds both groups', () => {
  const api = {
    tabs: () => [
      { tab: 'home', title: 'Home', here: true },
      { tab: 'global', title: 'Global', here: false },
    ],
    show() {},
    open() {},
  };
  expect(tabHits(api, '').filter((hit) => hit.title === 'Home')).toHaveLength(1);
  expect(tabHits(api, 'home').filter((hit) => hit.title === 'Home')).toHaveLength(2);
  expect(tabHits(api, '').filter((hit) => hit.title === 'Global')).toHaveLength(2);
});

it('Stats uses dashes and words, labels compound parts, and retains one expanded relay and request', async () => {
  setLang('en');
  const stats: EngineStats = {
    relays: ['one', 'two', 'never'].map((name, i) => ({
      url: `wss://long-relay-${name}.example/path-${name}`,
      state: i === 2 ? 'connecting' : 'connected',
      connectedSince: i === 2 ? null : 1,
      eventsReceived: 0,
      duplicatesDropped: 0,
      openSubscriptions: 0,
      bytesIn: 0,
      bytesOut: 0,
      lastError: null,
      latencyMs: null,
      route: 'both',
      readRule: 'reader',
      followedCovered: 0,
      weight: 0,
      publishAccepted: 0,
      publishPlanned: 0,
      publishPending: 0,
      publishFailed: 0,
      publishOwnSkipped: 0,
      publishInboxSkipped: 0,
      publishCapacitySkipped: 0,
    })),
    requests: [
      {
        id: 'logical',
        wireId: 'wire',
        relay: 'wss://one.example/path',
        purpose: 'own',
        priority: 1,
        weight: 10,
        received: 0,
        sent: true,
        complete: false,
        members: 1,
      },
    ],
    totals: {
      eventsStored: 0,
      cacheBytes: 0,
      subscriptions: 0,
      servedFromCache: 0,
      servedFromNetwork: 0,
    },
    orchestration: { relaysCoveringFollowSet: 0, requestsCoalesced: 0 },
  };
  const el = document.createElement('div');
  document.body.append(el);
  const base = {
    ...env(),
    visible: createSignal(true),
    menu() {},
    engine: { stats: async () => stats },
  } as unknown as ViewEnv;
  let off = mountStats(el, base);
  await Promise.resolve();
  const rows = () => [...el.querySelectorAll<HTMLElement>('.relay-stats .stats-toggle')];
  for (const selector of [
    '.c-data',
    '.c-publishAccepted',
    '.c-publishPending',
    '.c-publishOwnSkipped',
    '.c-followedCovered',
    '.c-weight',
  ])
    expect(rows()[0]?.querySelector(selector)?.textContent).toBe('—');
  expect(rows()[1]?.querySelector('.c-readRule')?.textContent).toBe('Reading and writing');
  for (const cell of rows()[0]!.querySelectorAll('td:not(.c-health)'))
    expect(cell.textContent).toBe('—');
  expect(el.querySelector('th.c-publishAccepted')?.getAttribute('title')).toContain(
    'planned destinations',
  );
  expect(rows()[0]?.querySelector('.c-publishOwnSkipped')?.getAttribute('title')).toContain(
    'recipient inbox',
  );
  rows()[0]?.click();
  rows()[1]?.click();
  expect(el.querySelectorAll('.relay-stats .stats-detail:not([hidden])')).toHaveLength(1);
  const request = el.querySelector<HTMLElement>('.request-stats .stats-toggle')!;
  request.click();
  expect(el.querySelector('.request-stats .stats-detail:not([hidden])')?.textContent).toContain(
    'logical / wire',
  );
  const state = loadViewState('looks');
  off();
  off = mountStats(el, base);
  await Promise.resolve();
  expect(loadViewState('looks')).toEqual(state);
  expect(rows()[1]?.getAttribute('aria-expanded')).toBe('true');
  expect(el.querySelectorAll('.request-stats .stats-detail:not([hidden])')).toHaveLength(1);
  el.querySelector<HTMLButtonElement>('th.c-events button')?.click();
  expect(loadViewState('looks')).toMatchObject(state);
  off();
});
