import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineStats } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { OrchStats } from '../src/views/orch-model.ts';
import { relayLines } from '../src/views/orch-model.ts';
import { mountOrchestration } from '../src/views/orchestration.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { mountStats } from '../src/views/stats.ts';

const NPUB = 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqsxlkjtest';
const HEX = 'ab'.repeat(32);
const NAME = 'Hanako Private';
type Relay = EngineStats['relays'][number];
const relay = (url: string, over: Partial<Relay> = {}): Relay => ({
  url,
  state: 'connected',
  connectedSince: 1,
  eventsReceived: 40,
  duplicatesDropped: 4,
  openSubscriptions: 2,
  bytesIn: 1000,
  bytesOut: 100,
  lastError: null,
  latencyMs: 80,
  ...over,
});
const stats = (): OrchStats => ({
  nowMs: 50_000,
  relays: [
    relay('wss://relay.public.example/'),
    relay('ws://192.168.1.20:7777/', { isPrivateHost: true, readRule: 'reader' }),
    relay('wss://home-nas.local/', { route: 'own' }),
  ],
  requests: [
    {
      id: 'q1',
      relay: 'ws://192.168.1.20:7777/',
      wireId: 'w1',
      purpose: 'focused',
      priority: 1,
      weight: 600,
      received: 3,
      sent: true,
      complete: false,
      members: 2,
      memberSubs: ['v1'],
      role: 'primary',
    },
  ],
  views: [
    {
      subId: 'v1',
      source: 'profile',
      visible: true,
      focused: true,
      rowCount: 12,
      windowKind: 'top',
      freshCount: 0,
    },
  ],
  bandwidthHistory: [
    {
      atMs: 49_000,
      bytesIn: 2000,
      bytesOut: 10,
      eventsIn: 4,
      duplicates: 1,
      verified: 3,
      reqsSent: 1,
    },
  ],
  orchestrationEvents: [
    {
      atMs: 49_500,
      kind: 'cooldown',
      relay: 'ws://192.168.1.20:7777/',
      summary: `${NAME} ${NPUB}`,
    },
    { atMs: 49_600, kind: 'hedge', relay: 'wss://home-nas.local/', summary: HEX },
  ],
  totals: {
    eventsStored: 1,
    cacheBytes: 1,
    subscriptions: 1,
    servedFromCache: 0,
    servedFromNetwork: 1,
  },
  orchestration: { relaysCoveringFollowSet: 1, requestsCoalesced: 1 },
});

const mount = (
  s: () => OrchStats | undefined,
  visible = createSignal(true),
  instance = 'orch-test',
) => {
  const asked = vi.fn(async () => s() as EngineStats | undefined);
  const engine = {
    stats: asked,
    // A signed-in account with a name and key: the tab must never draw them.
    accounts: {
      get: () => ({ active: HEX, accounts: [{ author: { pubkey: HEX, name: NAME, npub: NPUB } }] }),
    },
  };
  const el = document.createElement('div');
  document.body.append(el);
  const off = mountOrchestration(el, {
    instance,
    visible,
    menu() {},
    open() {},
    engine,
  } as unknown as ViewEnv);
  return { el, asked, visible, off };
};
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
  setLang('en');
});

describe('orchestration', () => {
  it('Stage-safe (on for a new tab) draws no private host, key or name', async () => {
    const { el, off } = mount(stats);
    try {
      await flush();
      const text = el.textContent ?? '';
      expect(text).toContain('relay.public.example');
      expect(text).toContain('Private relay ×2');
      expect(text).toContain('Profile');
      for (const secret of ['192.168', '7777', 'home-nas', NPUB, HEX, NAME, 'npub1'])
        expect(text, secret).not.toContain(secret);
      expect(el.querySelector('[data-chip="safe"]')?.getAttribute('aria-pressed')).toBe('true');
    } finally {
      off();
    }
  });

  it('Stage-safe off shows the reader’s own private relay by host; turning it on hides it again at once', async () => {
    const { el, off } = mount(stats);
    try {
      await flush();
      const chip = el.querySelector<HTMLButtonElement>('[data-chip="safe"]')!;
      chip.click();
      expect(el.textContent).toContain('192.168.1.20:7777');
      // Pause, then Stage-safe on: the frozen picture is redrawn without the host.
      el.querySelector<HTMLButtonElement>('[data-chip="paused"]')!.click();
      chip.click();
      expect(el.textContent).not.toContain('192.168');
      expect(el.textContent).not.toContain(NAME);
    } finally {
      off();
    }
  });

  it('groups every private relay into one summed row when Stage-safe is on', () => {
    const lines = relayLines(stats().relays, true);
    expect(lines.map((l) => l.key)).toEqual(['wss://relay.public.example/', 'private']);
    expect(lines[1]!.members).toHaveLength(2);
  });

  it('polls once a second only while in front, and not at all hidden or folded', async () => {
    vi.useFakeTimers();
    const visible = createSignal(true);
    const { asked, off } = mount(stats, visible);
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    const shown = asked.mock.calls.length;
    expect(shown).toBeGreaterThanOrEqual(3);
    // Another tab in front, or the tile folded: the view is off screen and `visible` goes false.
    visible.set(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(asked.mock.calls.length).toBe(shown);
    off();
  });

  it('shares one poll with a Stats tab on the same engine', async () => {
    vi.useFakeTimers();
    const asked = vi.fn(async () => stats() as unknown as EngineStats);
    const engine = { stats: asked };
    const env = (instance: string) =>
      ({
        instance,
        visible: createSignal(true),
        menu() {},
        open() {},
        engine,
      }) as unknown as ViewEnv;
    const a = document.createElement('div');
    const b = document.createElement('div');
    const offA = mountOrchestration(a, env('o1'));
    const offB = mountStats(b, env('s1'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(asked.mock.calls.length).toBeLessThanOrEqual(7);
    offA();
    offB();
    const after = asked.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(asked.mock.calls.length).toBe(after);
  });

  it('leaves out bands the engine does not report, and draws a dash for absent figures', async () => {
    const bare = (): OrchStats => ({
      ...stats(),
      views: undefined,
      worker: undefined,
      bandwidthHistory: undefined,
      orchestrationEvents: undefined,
      requests: undefined,
    });
    const { el, off } = mount(bare);
    try {
      await flush();
      expect(el.querySelector<HTMLElement>('.oworker')!.hidden).toBe(true);
      expect(el.querySelector<HTMLElement>('.olink')!.hidden).toBe(true);
      expect(el.querySelector<HTMLElement>('.oevband')!.hidden).toBe(true);
      expect(el.querySelector<HTMLElement>('.oopt')!.hidden).toBe(true);
      expect(el.querySelector('.ofig .oval')?.textContent).toBe('—');
    } finally {
      off();
    }
  });

  it('remembers Large and Stage-safe with the tab', async () => {
    const first = mount(stats, createSignal(true), 'orch-keep');
    await flush();
    first.el.querySelector<HTMLButtonElement>('[data-chip="large"]')!.click();
    first.el.querySelector<HTMLButtonElement>('[data-chip="safe"]')!.click();
    first.off();
    const again = mount(stats, createSignal(true), 'orch-keep');
    expect(again.el.classList.contains('large')).toBe(true);
    expect(again.el.querySelector('[data-chip="safe"]')?.getAttribute('aria-pressed')).toBe(
      'false',
    );
    again.off();
  });
});
