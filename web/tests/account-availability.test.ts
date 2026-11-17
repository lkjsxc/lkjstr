import { afterEach, expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld } from '../src/engine/mock/world.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { mountFeed } from '../src/views/feed.ts';
import { account, PUBKEY, vaultEnv } from './vault-ui-fixture.ts';

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});
function client() {
  let receive!: (message: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (message) => void sent.push(message),
    listen: (handler) => {
      receive = handler;
    },
    close() {},
  });
  cleanup.push(() => engine.dispose());
  const ready = () => receive({ t: 'ready', version: 13, engine: 'fixture' });
  const fail = () =>
    receive({ t: 'ready', version: 13, engine: 'fixture', accountError: { code: 'internal' } });
  return { engine, sent, receive, ready, fail };
}
function feed(kind: string, saved = false) {
  const fixture = vaultEnv();
  cleanup.push(fixture.dispose);
  const c = client();
  c.ready();
  if (saved) c.receive({ t: 'accounts', accounts: [account()], active: PUBKEY });
  const mount = () =>
    cleanup.push(mountFeed(fixture.el, { ...fixture.env, engine: c.engine }, kind));
  mount();
  const opened = c.sent.find((message) => message.t === 'open');
  if (opened?.t !== 'open') throw new Error('missing fixture subscription');
  return { ...c, ...fixture, sub: opened.sub };
}
function row() {
  const world = createWorld(1_800_000_000_000);
  const source = world.notes[0];
  if (!source) throw new Error('missing fixture note');
  return { ...noteRow(world, source, { me: '' }), media: [], quotes: [] };
}

it('keeps capability readiness distinct from confirmed empty Accounts', () => {
  const c = client();
  expect(c.engine.accountState?.get()).toEqual({ phase: 'loading' });
  c.ready();
  expect(c.engine.info.get()?.version).toBe(13);
  expect(c.engine.accountState?.get()).toEqual({ phase: 'loading' });
  c.receive({ t: 'accounts', accounts: [] });
  expect(c.engine.accountState?.get()).toEqual({ phase: 'ready' });
});
it('reports failed boot without inventing an Accounts snapshot', () => {
  const c = client(),
    changed = vi.fn();
  c.engine.accounts.subscribe(changed);
  c.fail();
  expect(c.engine.accountState?.get()).toEqual({ phase: 'failed', error: { code: 'internal' } });
  expect(changed).not.toHaveBeenCalled();
  expect(c.engine.info.get()).toEqual({ version: 13, engine: 'fixture' });
});
it('retains accounts across reconnect and failed boot until an actual snapshot arrives', () => {
  const c = client();
  c.receive({ t: 'accounts', accounts: [account()], active: PUBKEY });
  const retained = c.engine.accounts.get();
  c.receive({ t: 'reconnect' });
  expect(c.engine.accounts.get()).toBe(retained);
  expect(c.engine.accountState?.get()).toEqual({ phase: 'loading' });
  c.fail();
  expect(c.engine.accounts.get()).toBe(retained);
  expect(c.engine.me()).toBe(PUBKEY);
  expect(c.engine.accountState?.get()?.phase).toBe('failed');
  c.receive({ t: 'accounts', accounts: [] });
  expect(c.engine.accountState?.get()).toEqual({ phase: 'ready' });
  expect(c.engine.accounts.get()).toEqual({ accounts: [], active: undefined });
});
it('does not treat another capability handshake as successful account loading', () => {
  const c = client();
  c.fail();
  c.ready();
  expect(c.engine.accountState?.get()?.phase).toBe('failed');
});
it('shows an internal subscription failure ahead of the signed-out Home branch', () => {
  const c = feed('home');
  c.receive({
    t: 'state',
    sub: c.sub,
    state: { phase: 'failed', error: 'internal', relaysAsked: 0, relaysAnswered: 0 },
  });
  expect(c.el.querySelector('.fstate')?.textContent).toBe(t('error.internal'));
  expect(c.el.querySelector('.fstate button')).toBeNull();
});
it('shows the failed Ready in the existing feed status before a subscription reply', () => {
  const c = feed('home');
  c.fail();
  expect(c.el.querySelector('.fstate')?.textContent).toBe(t('error.internal'));
});
it('keeps displayed rows and the query when a retained account becomes unavailable', () => {
  const c = feed('global', true),
    note = row();
  c.receive({ t: 'rows', sub: c.sub, rows: [note], atTop: true, atBottom: false });
  const node = c.el.querySelector('.list > .note');
  expect(node).not.toBeNull();
  const opens = c.sent.filter((message) => message.t === 'open').length;
  c.receive({ t: 'reconnect' });
  c.fail();
  expect(c.el.querySelector('.fstate')?.textContent).toBe(t('error.internal'));
  expect(c.el.querySelector('.list > .note')).toBe(node);
  expect(c.sent.filter((message) => message.t === 'open')).toHaveLength(opens);
  expect(c.engine.me()).toBe(PUBKEY);
});
it('keeps a nonempty feed when its subscription fails internally', () => {
  const c = feed('global'),
    note = row();
  c.receive({ t: 'rows', sub: c.sub, rows: [note], atTop: true, atBottom: false });
  const node = c.el.querySelector('.list > .note');
  c.receive({
    t: 'state',
    sub: c.sub,
    state: { phase: 'failed', error: 'internal', relaysAsked: 0, relaysAnswered: 0 },
  });
  expect(c.el.querySelector('.fstate')?.textContent).toBe(t('error.internal'));
  expect(c.el.querySelector('.list > .note')).toBe(node);
});
it('preserves the existing Sign in control for genuinely signed-out Home', () => {
  const c = feed('home');
  c.receive({ t: 'accounts', accounts: [] });
  expect(c.el.querySelector('.fstate button')?.textContent).toBe(t('bar.signedOut'));
});
it('preserves the existing non-internal relay failure wording', () => {
  const c = feed('global');
  c.receive({
    t: 'state',
    sub: c.sub,
    state: { phase: 'failed', error: 'offline', relaysAsked: 1, relaysAnswered: 0 },
  });
  expect(c.el.querySelector('.fstate')?.textContent).toBe(t('feed.failed'));
});
