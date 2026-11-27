import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineStats } from '../src/engine/protocol.ts';
import { setLang, t } from '../src/shared/i18n.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';
import { bytesText, mountStats, relayMark, sortRelays } from '../src/views/stats.ts';

type Relay = EngineStats['relays'][number];
const relay = (url: string, over: Partial<Relay> = {}): Relay => ({
  url,
  state: 'connected',
  connectedSince: 1,
  eventsReceived: 10,
  duplicatesDropped: 0,
  openSubscriptions: 1,
  bytesIn: 0,
  bytesOut: 0,
  lastError: null,
  latencyMs: 50,
  ...over,
});

afterEach(() => {
  localStorage.clear();
  setLang('en');
});

describe('stats', () => {
  it.each([
    ['publishOwnSkipped', '.c-publishOwnSkipped', '1 / — / —'],
    ['publishInboxSkipped', '.c-publishOwnSkipped', '— / 1 / —'],
    ['publishCapacitySkipped', '.c-publishOwnSkipped', '— / — / 1'],
    ['publishPlanned', '.c-publishAccepted', '— / 1'],
    ['publishAccepted', '.c-publishAccepted', '1 / —'],
    ['publishPending', '.c-publishPending', '1 / —'],
    ['publishFailed', '.c-publishPending', '— / 1'],
  ] as const)(
    'shows %s before connecting in cells and expanded details',
    async (field, cell, text) => {
      const r = relay('wss://excluded.example', {
        state: 'disconnected',
        connectedSince: null,
        eventsReceived: 0,
        openSubscriptions: 0,
        latencyMs: null,
        [field]: 1,
      });
      let stats: EngineStats = {
        relays: [r],
        totals: {
          eventsStored: 0,
          cacheBytes: 0,
          subscriptions: 0,
          servedFromCache: 0,
          servedFromNetwork: 0,
        },
        orchestration: { relaysCoveringFollowSet: 0, requestsCoalesced: 0 },
      };
      const visible = createSignal(true);
      const el = document.createElement('div');
      const off = mountStats(el, {
        instance: 'publication-stats',
        visible,
        menu() {},
        engine: { stats: async () => stats },
      } as unknown as ViewEnv);
      try {
        await Promise.resolve();
        const row = el.querySelector<HTMLElement>('.relay-stats .stats-toggle')!;
        expect(row.querySelector(cell)?.textContent).toBe(text);
        expect(row.querySelector('.c-data')?.textContent).toBe('—');
        expect(row.querySelector('.c-events')?.textContent).toBe('—');
        row.click();
        const detail = el.querySelector<HTMLElement>('.relay-stats .stats-detail')!;
        expect(detail.hidden).toBe(false);
        expect([...detail.querySelectorAll('dd')].map((dd) => dd.textContent)).toContain(text);
        // A later snapshot with no publication activity restores the dash in both views.
        stats = { ...stats, relays: [{ ...r, [field]: 0 }] };
        visible.set(false);
        visible.set(true);
        await Promise.resolve();
        expect(row.querySelector(cell)?.textContent).toBe('—');
        expect([...detail.querySelectorAll('dd')].every((dd) => dd.textContent !== text)).toBe(
          true,
        );
      } finally {
        off();
      }
    },
  );

  it('shares one poll across visible Stats tabs and stops when the last one hides', async () => {
    vi.useFakeTimers();
    const stats = vi.fn(async () => undefined);
    const engine = { stats };
    const mount = (instance: string) => {
      const visible = createSignal(true);
      const off = mountStats(document.createElement('div'), {
        instance,
        visible,
        menu() {},
        engine,
      } as unknown as ViewEnv);
      return { visible, off };
    };
    const a = mount('stats-a');
    const b = mount('stats-b');
    try {
      await vi.advanceTimersByTimeAsync(3000);
      expect(stats).toHaveBeenCalledTimes(4);
      a.visible.set(false);
      await vi.advanceTimersByTimeAsync(1000);
      expect(stats).toHaveBeenCalledTimes(5);
      b.visible.set(false);
      await vi.advanceTimersByTimeAsync(3000);
      expect(stats).toHaveBeenCalledTimes(5);
    } finally {
      a.off();
      b.off();
      vi.useRealTimers();
    }
  });

  it('replaces a missing response with current figures on the next poll', async () => {
    vi.useFakeTimers();
    setLang('ja');
    let snapshot: EngineStats | undefined;
    const el = document.createElement('div');
    const off = mountStats(el, {
      instance: 'stats-recovery',
      visible: createSignal(true),
      menu() {},
      engine: { stats: async () => snapshot },
    } as unknown as ViewEnv);
    try {
      await Promise.resolve();
      expect(el.querySelector<HTMLElement>('.sfigs')?.hidden).toBe(true);
      expect(el.querySelector('.fstate')?.textContent).toBe(t('stats.none'));
      snapshot = {
        relays: [
          relay('wss://down.example', { state: 'failed' }),
          relay('wss://slow.example', { latencyMs: 2000 }),
        ],
        totals: {
          eventsStored: 39,
          cacheBytes: 40,
          subscriptions: 4,
          servedFromCache: 3,
          servedFromNetwork: 1,
        },
        orchestration: { relaysCoveringFollowSet: 1, requestsCoalesced: 0 },
      };
      await vi.advanceTimersByTimeAsync(1000);
      const summary = el.querySelector<HTMLElement>('.sfigs');
      expect(summary?.hidden).toBe(false);
      expect([...el.querySelectorAll('.sval')].map((value) => value.textContent)).toEqual([
        '1/2',
        '75%',
        '0',
        '39',
      ]);
      expect(summary?.textContent).not.toMatch(/フォローを届けるリレー|失敗 1|遅い 1/);
      expect(el.querySelector<HTMLElement>('.fstate')?.hidden).toBe(true);
      snapshot = undefined;
      await vi.advanceTimersByTimeAsync(1000);
      expect(summary?.hidden).toBe(false);
      expect(el.querySelector<HTMLElement>('.fstate')?.hidden).toBe(true);
    } finally {
      off();
      vi.useRealTimers();
    }
  });

  it('marks a relay that fails, sends nothing, or answers slowly', () => {
    expect(relayMark(relay('a'))).toBeUndefined();
    expect(relayMark(relay('a', { state: 'waiting', lastError: 'refused' }))).toBe('failing');
    expect(relayMark(relay('a', { state: 'failed' }))).toBe('failing');
    expect(relayMark(relay('a', { eventsReceived: 0 }))).toBe('silent');
    expect(relayMark(relay('a', { eventsReceived: 0, openSubscriptions: 0 }))).toBeUndefined();
    expect(relayMark(relay('a', { latencyMs: 2400 }))).toBe('slow');
    expect(relayMark(relay('a', { latencyMs: null }))).toBeUndefined();
    expect(relayMark(relay('a', { state: 'connecting', eventsReceived: 0 }))).toBeUndefined();
  });

  it('sorts trouble first, then by what was received; a missing figure is last either way', () => {
    const all = [
      relay('wss://fine', { eventsReceived: 5 }),
      relay('wss://busy', { eventsReceived: 900 }),
      relay('wss://slow', { latencyMs: 3000 }),
      relay('wss://down', { state: 'waiting', latencyMs: null, eventsReceived: 0 }),
      relay('wss://mute', { eventsReceived: 0, latencyMs: 20 }),
    ];
    const order = (by: Parameters<typeof sortRelays>[1]['by'], up = false): string[] =>
      sortRelays(all, { by, up }).map((r) => r.url.slice(6));
    expect(order('health')).toEqual(['down', 'mute', 'slow', 'busy', 'fine']);
    expect(order('events')).toEqual(['busy', 'slow', 'fine', 'down', 'mute']);
    expect(order('latency')).toEqual(['slow', 'busy', 'fine', 'mute', 'down']);
    expect(order('latency', true)).toEqual(['mute', 'busy', 'fine', 'slow', 'down']);
  });

  it('sorts grouped publication columns by their leading count, with unreported figures last', () => {
    const rows = [
      relay('missing'),
      relay('zero', { publishAccepted: 0, publishPlanned: 99 }),
      relay('sent', { publishAccepted: 8, publishPlanned: 8 }),
    ];
    expect(sortRelays(rows, { by: 'publishAccepted', up: false }).map((r) => r.url)).toEqual([
      'sent',
      'zero',
      'missing',
    ]);
    expect(sortRelays(rows, { by: 'publishAccepted', up: true }).map((r) => r.url)).toEqual([
      'zero',
      'sent',
      'missing',
    ]);
  });

  it('sorts measured coverage and weights while keeping absent fields last', () => {
    const rows = [
      relay('absent'),
      relay('zero', { followedCovered: 0, weight: 0 }),
      relay('covered', { followedCovered: 20, weight: 600 }),
    ];
    expect(sortRelays(rows, { by: 'followedCovered', up: false }).map((r) => r.url)).toEqual([
      'covered',
      'zero',
      'absent',
    ]);
    expect(sortRelays(rows, { by: 'weight', up: true }).map((r) => r.url)).toEqual([
      'zero',
      'covered',
      'absent',
    ]);
  });

  it('writes sizes in decimal units', () => {
    expect(bytesText(0)).toBe('0 B');
    expect(bytesText(999)).toBe('999 B');
    expect(bytesText(1234)).toBe('1.2 kB');
    expect(bytesText(308_000)).toBe('308 kB');
    expect(bytesText(8_420_000)).toBe('8.4 MB');
  });
});
