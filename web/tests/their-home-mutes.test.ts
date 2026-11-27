import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteRow, Query } from '../src/engine/protocol.ts';
import {
  readPublicSnapshot,
  snapshotIdentity,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import { renderNote } from '../src/views/note.ts';
import { quoteCard } from '../src/views/note-quote.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { harness, note } from './public-snapshots-support.ts';

const owner = 'a'.repeat(64);
const viewer = 'b'.repeat(64);
const query: Query = { source: 'their-home', pubkey: owner, account: viewer };
// Finished Worker rows for one fixture owner with public p/e/t/word entries.
const reasons = [
  'their-muted-person',
  'their-muted-thread',
  'their-muted-hashtag',
  'their-muted-word',
];
const covers = reasons.map(
  (reason, i): NoteRow => ({
    ...note(String(i + 1).repeat(64)),
    segments: [],
    media: [],
    quotes: [],
    reactions: [],
    hidden: { reason, revealable: true },
  }),
);
const environment = () => {
  const reveal = vi.fn(async () => true);
  const open = vi.fn();
  const env = {
    instance: 'their-mutes',
    settings: createSettings(),
    open,
    engine: {
      reveal,
      me: () => viewer,
      info: { get: () => ({ version: 15 }) },
      accounts: createSignal({ accounts: [] }),
    },
  } as unknown as ViewEnv;
  return { env, reveal, open };
};
const painted = (h: ReturnType<typeof harness>) =>
  h.messages.filter((message) => message.t === 'rows');
const allow = (h: ReturnType<typeof harness>) =>
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});

describe.each(['en', 'ja'] as const)('Their Home mute disclosure in %s', (lang) => {
  it.each(covers)(
    'keeps the scoped reason $hidden.reason and offers reveal without viewer settings',
    async (row) => {
      setLang(lang);
      const { env, reveal, open } = environment();
      const el = renderNote(
        { ...row, segments: [{ k: 'text', text: 'must not be painted' }] },
        env,
        false,
      );
      const ownerCopy = lang === 'en' ? 'this Home’s owner' : 'このホームの持ち主';
      expect(el.textContent).toContain(ownerCopy);
      expect(el.textContent).not.toContain('must not be painted');
      expect(el.querySelector('.av, img, .text')).toBeNull();
      el.querySelector<HTMLButtonElement>('.hline button')?.click();
      const why = el.querySelector('.hwhy');
      expect(why?.textContent).toContain(lang === 'en' ? 'public' : '公開ミュートリスト');
      expect(why?.querySelector('button')).toBeNull();
      expect(open).not.toHaveBeenCalled();
      el.querySelector<HTMLButtonElement>('.hline button:last-child')?.click();
      await Promise.resolve();
      expect(reveal).toHaveBeenCalledWith(el, row.key, true);
      const shown = renderNote(
        { ...row, hidden: undefined, revealed: { reason: row.hidden?.reason ?? '' } },
        env,
        false,
      );
      expect(shown.querySelector('.hshown')?.textContent).toContain(ownerCopy);
      shown.querySelector<HTMLButtonElement>('.hshown button')?.click();
      expect(reveal).toHaveBeenLastCalledWith(shown, row.key, false);
      const quoted = quoteCard(
        { state: 'muted', id: row.id, reason: row.hidden?.reason },
        env,
        'outer',
      );
      expect(quoted.textContent).toContain(ownerCopy);
    },
  );
});

it('preserves all scoped covers in ordinary replay and never replays them into own Home or another owner', async () => {
  const saved = harness();
  saved.open(query);
  allow(saved);
  saved.rows(covers);
  saved.transport.close();
  for (const next of [
    { source: 'home', account: viewer },
    { ...query, pubkey: 'c'.repeat(64) },
  ] as Query[]) {
    const h = harness();
    h.open(next);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(h)).toEqual([]);
    h.transport.close();
  }
  const h = harness();
  h.open(query);
  await vi.advanceTimersByTimeAsync(0);
  expect(
    painted(h)
      .at(-1)
      ?.rows.map((row) => row.kind === 'note' && row.hidden?.reason),
  ).toEqual(reasons);
  h.transport.post({ t: 'open', sub: 'one', query: { source: 'home', account: viewer } });
  h.transport.post({ t: 'window', sub: 'one', anchor: 'top', before: 0, after: 60 });
  h.messages.length = 0;
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(h)).toEqual([]);
  h.transport.close();
});

it('does not read pre-policy snapshots and keeps Moment visits out of ordinary replay', async () => {
  const identity = snapshotIdentity(query, 'en', true);
  const legacy = JSON.stringify(
    (JSON.parse(identity) as unknown[]).filter((part) => part !== 'public-mutes'),
  );
  const snapshot = { rows: covers, anchor: covers[0]?.key ?? '', atTop: true, atBottom: false };
  writePublicSnapshot(legacy, true, snapshot);
  const cold = harness();
  cold.open(query);
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(cold)).toEqual([]);
  cold.transport.close();
  writePublicSnapshot(identity, true, snapshot);
  const h = harness();
  h.open(query);
  h.transport.post({ t: 'window', sub: 'one', anchor: { at: 1000 }, before: 20, after: 20 });
  allow(h);
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(h)).toEqual([]);
  h.rows(covers.map((row) => ({ ...row, readingAt: row.at })));
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();
  expect(readPublicSnapshot(identity, 'top')?.rows).toEqual(covers);
});

it('replaces cached visible bodies with a live public mute cover and excludes revealed bodies from persistence', async () => {
  const h = harness();
  h.open(query);
  allow(h);
  const visible = {
    ...covers[0],
    hidden: undefined,
    segments: [{ k: 'text' as const, text: 'old visible body' }],
  } as NoteRow;
  h.rows([visible]);
  await vi.advanceTimersByTimeAsync(201);
  const cover = covers[0] as NoteRow;
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: cover }] });
  await vi.advanceTimersByTimeAsync(201);
  const identity = snapshotIdentity(query, 'en', true);
  expect(readPublicSnapshot(identity, 'top')?.rows[0]).toEqual(cover);
  h.emit({
    t: 'patch',
    sub: 'one',
    ops: [
      {
        op: 'update',
        row: {
          ...visible,
          segments: [{ k: 'text', text: 'revealed fixture body' }],
          revealed: { reason: 'their-muted-person' },
        },
      },
    ],
  });
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();
  expect(readPublicSnapshot(identity, 'top')).toBeUndefined();
});
