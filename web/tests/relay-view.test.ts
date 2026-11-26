import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { servedBy } from '../src/engine/mock/relays.ts';
import type { FromEngine, RelayRow } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import { feedTitle } from '../src/views/feed-title.ts';
import { feedWindow } from '../src/views/feed-window.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { relayState, renderRelayHead, softwareText } from '../src/views/relay-head.ts';
import { CHOICES } from '../src/wm/choices.ts';

const URL = 'wss://relay.example.jp';
const head = (more: Partial<RelayRow> = {}): RelayRow => ({
  kind: 'relay',
  key: `relay:${URL}`,
  url: URL,
  state: 'connected',
  inUse: true,
  why: 'unused',
  read: false,
  write: false,
  subs: 0,
  events: 3,
  latencyMs: 40,
  info: 'ready',
  ...more,
});
const env = {
  open: vi.fn(),
  engine: { accounts: createSignal({ accounts: [] }), info: createSignal({ version: 5 }) },
} as unknown as ViewEnv;
let engine: MockEngine | undefined;
afterEach(() => (engine?.dispose(), (engine = undefined), vi.useRealTimers(), setLang('en')));
beforeEach(() => setLang('en'));

it('names the software as a reader would and keeps text that is no address', () => {
  expect(softwareText('git+https://github.com/hoytech/strfry.git', '1.0.4')).toBe('strfry 1.0.4');
  expect(softwareText('nostr-rs-relay')).toBe('nostr-rs-relay');
  expect(softwareText(undefined, undefined)).toBe('');
});

it('draws what the relay says of itself, and says when it is still asked or said nothing', () => {
  const el = renderRelayHead(
    head({
      name: 'Example relay',
      description: 'Be kind.',
      software: 'git+https://example.test/relay.git',
      version: '2',
      nips: [1, 11, 50],
      limits: ['auth', 'restricted'],
      pow: 8,
      read: true,
    }),
    env,
  );
  expect(el.querySelector('.pname')?.textContent).toBe('Example relay');
  expect(el.querySelector('.npub')?.textContent).toBe(URL);
  expect(el.querySelector('.about')?.textContent).toBe('Be kind.');
  expect(el.textContent).toContain('On your list: Read');
  expect(el.textContent).toContain('relay 2');
  expect([...el.querySelectorAll('.rlimits .chip')].map((c) => c.textContent)).toEqual([
    'Sign-in required',
    'Writing restricted',
    'Proof of work 8',
  ]);
  expect(el.querySelector('.rnips')?.textContent).toBe('NIPs 1 · 11 · 50');
  // Unnamed, it is its host; not on the list, it says so.
  const bare = renderRelayHead(head({ info: 'unknown' }), env);
  expect(bare.querySelector('.pname')?.textContent).toBe('relay.example.jp');
  expect(bare.querySelector('.about')?.textContent).toBe('Asking the relay about itself…');
  expect(bare.textContent).toContain('Not on your list');
  const missing = renderRelayHead(
    head({ info: 'missing', state: 'failed', error: 'refused' }),
    env,
  );
  expect(missing.querySelector('.about')?.textContent).toBe('This relay does not describe itself.');
  expect(relayState(head({ state: 'failed', error: 'refused' }))).toBe('Not connected · refused');
});

it('is a child feed titled by its host, whose head is not part of the note window', () => {
  expect(feedTitle('relay', [], { relay: `${URL}/` })).toBe('relay.example.jp');
  const rows = [head(), { kind: 'note', key: 'n1' }] as never;
  expect(feedWindow('relay', rows)).toEqual({ first: 'n1', last: 'n1', count: 1 });
});

it('opens from a relay address typed into tab search', () => {
  const [choice] = CHOICES.typed('wss://relay.example.jp');
  expect(choice).toMatchObject({ kind: 'relay', state: { relay: URL } });
  expect(choice?.title).toBe('Open the relay relay.example.jp');
  expect(CHOICES.typed('https://relay.example.jp').some((c) => c.kind === 'relay')).toBe(false);
});

it('the mock serves one relay: its head first, then only the notes it served', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [];
  engine = createMockEngine((m) => out.push(structuredClone(m)));
  engine.handle({ t: 'configure', config: { language: 'en', mock: { live: false } } } as never);
  vi.advanceTimersByTime(10);
  engine.handle({ t: 'open', sub: 'r', query: { source: 'relay', relay: URL } });
  engine.handle({ t: 'window', sub: 'r', anchor: 'top', before: 0, after: 30 });
  const rows = out.filter((m) => m.t === 'rows').at(-1)?.rows ?? [];
  expect(rows[0]).toMatchObject({ kind: 'relay', url: URL, info: 'ready' });
  const notes = rows.slice(1);
  expect(notes.length).toBeGreaterThan(0);
  expect(notes.every((n) => n.kind === 'note' && servedBy(URL, n.id))).toBe(true);
});

it('flows: notes the relay sends while the tab is open arrive under its head, and stop when it closes', () => {
  vi.useFakeTimers();
  const out: FromEngine[] = [];
  engine = createMockEngine((m) => out.push(structuredClone(m)));
  engine.handle({ t: 'configure', config: { language: 'en' } } as never);
  vi.advanceTimersByTime(10);
  engine.handle({ t: 'open', sub: 'r', query: { source: 'relay', relay: URL } });
  engine.handle({ t: 'window', sub: 'r', anchor: 'top', before: 0, after: 30 });
  const first = out.filter((m) => m.t === 'rows').at(-1)?.rows ?? [];
  const inserts = () =>
    out
      .flatMap((m) => (m.t === 'patch' && m.sub === 'r' ? m.ops : []))
      .filter((o) => o.op === 'insert');
  vi.advanceTimersByTime(120_000);
  const arrived = inserts();
  expect(arrived.length).toBeGreaterThan(0);
  // Each arrival goes in above the note that led the list, never above the head.
  expect(arrived[0]).toMatchObject({ before: first[1]?.key });
  const rows = arrived.flatMap((o) => (o.op === 'insert' ? o.rows : []));
  expect(rows.every((n) => n.kind === 'note' && servedBy(URL, n.id))).toBe(true);
  engine.handle({ t: 'close', sub: 'r' });
  const seen = out.filter((m) => 'sub' in m && m.sub === 'r').length;
  vi.advanceTimersByTime(120_000);
  expect(out.filter((m) => 'sub' in m && m.sub === 'r').length).toBe(seen);
});
