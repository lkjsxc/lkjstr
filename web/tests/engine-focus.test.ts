import { expect, it, vi } from 'vitest';
import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { h } from '../src/shared/h.ts';

it('sends the keyboard tile subscription and clears it on hiding or closing', async () => {
  const messages: ToEngine[] = [];
  const engine = createEngine({ post: (m) => messages.push(m), listen() {}, close() {} });
  const owner = h('div', { class: 'view' });
  const pane = h('div', { class: 'pane cur' }, owner);
  document.body.append(pane);
  const sub = engine.open({ source: 'global' }, { rows() {}, patch() {} }, owner);
  const last = () => messages.filter((m) => m.t === 'hint').at(-1)?.hint;
  try {
    sub.visible(true);
    await Promise.resolve();
    expect(last()?.focusedSub).toBe(sub.id);
    sub.visible(false);
    await Promise.resolve();
    expect(last()?.focusedSub).toBeUndefined();
    sub.visible(true);
    await Promise.resolve();
    sub.close();
    await Promise.resolve();
    expect(last()?.focusedSub).toBeUndefined();
    expect(last()?.visibleSubs).toEqual([]);
  } finally {
    pane.remove();
    engine.dispose();
  }
});

it('routes the time window report to its open subscription only', () => {
  const sent: ToEngine[] = [];
  let receive: (message: FromEngine) => void = () => {};
  const engine = createEngine({
    post: (msg) => sent.push(msg),
    listen: (handler) => {
      receive = handler;
    },
    close() {},
  });
  const timeWindow = vi.fn();
  try {
    receive({ t: 'ready', engine: 'rust-wasm-worker', version: 15 });
    const sub = engine.open({ source: 'their-home' }, { rows() {}, patch() {}, timeWindow });
    sub.window({ at: 42_000 }, 1, 2);
    expect(sent.at(-1)).toEqual({
      t: 'window',
      sub: sub.id,
      anchor: { at: 42_000 },
      before: 1,
      after: 2,
    });
    const report = {
      t: 'timeWindow',
      sub: sub.id,
      at: 42_000,
      newer: 'cache-only',
      older: 'cache-only',
    } as const;
    receive({ ...report, sub: 'elsewhere' });
    receive(report);
    sub.close();
    receive(report);
    expect(timeWindow.mock.calls).toEqual([[report]]);
  } finally {
    engine.dispose();
  }
});
