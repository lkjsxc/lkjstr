import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type ActivityChannel, createAccountActivity } from '../src/shared/account-activity.ts';
import { createIdleLock } from '../src/shared/account-idle.ts';
import { tick, vaultEnv } from './vault-ui-fixture.ts';

function bus() {
  const ports: ActivityChannel[] = [];
  const sent: unknown[] = [];
  let delay = 0;
  const create = () => {
    let closed = false;
    const channel: ActivityChannel = {
      onmessage: null,
      postMessage(data) {
        if (closed) return;
        sent.push(structuredClone(data));
        for (const other of ports)
          if (other !== channel)
            setTimeout(
              () =>
                other.onmessage?.call(
                  other as BroadcastChannel,
                  new MessageEvent('message', { data }),
                ),
              delay,
            );
      },
      close() {
        if (closed) return;
        closed = true;
        ports.splice(ports.indexOf(channel), 1);
      },
    };
    ports.push(channel);
    return {
      channel,
      page: Object.assign(new EventTarget(), { hidden: false }),
      wake: new EventTarget(),
      closed: () => closed,
    };
  };
  return {
    create,
    sent,
    lag(ms: number) {
      delay = ms;
    },
    inject(data: unknown) {
      for (const port of ports)
        port.onmessage?.call(port as BroadcastChannel, new MessageEvent('message', { data }));
    },
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('an active sibling keeps a hidden page unlocked, then both idle pages lock after a bounded probe', async () => {
  const b = bus();
  const a = vaultEnv({ encrypted: true, locked: false });
  const z = vaultEnv({ encrypted: true, locked: false });
  const ap = b.create();
  const zp = b.create();
  a.env.settings.patch({ lockIdle: 1 });
  z.env.settings.patch({ lockIdle: 1 });
  const stopA = createIdleLock(a.env.engine, a.env.settings, ap);
  const stopZ = createIdleLock(z.env.engine, z.env.settings, zp);
  try {
    ap.page.hidden = true;
    for (let n = 0; n < 4; n++) {
      await vi.advanceTimersByTimeAsync(40_000);
      zp.page.dispatchEvent(new KeyboardEvent('keydown'));
      await vi.advanceTimersByTimeAsync(0);
      expect(a.act).not.toHaveBeenCalled();
      expect(z.act).not.toHaveBeenCalled();
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.act).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(750);
    expect(a.act).toHaveBeenCalledOnce();
    expect(z.act).toHaveBeenCalledOnce();
  } finally {
    stopA();
    stopZ();
    a.dispose();
    z.dispose();
  }
});

it('wake probes allow a queued sibling activity reply before locking', async () => {
  const b = bus();
  const a = vaultEnv({ encrypted: true, locked: false });
  const ap = b.create();
  const zp = b.create();
  a.env.settings.patch({ lockIdle: 1 });
  const stopA = createIdleLock(a.env.engine, a.env.settings, ap);
  const sibling = createAccountActivity(() => {}, zp);
  try {
    await tick();
    ap.page.hidden = true;
    vi.setSystemTime(Date.now() + 90_000);
    b.lag(300);
    zp.page.dispatchEvent(new KeyboardEvent('keydown'));
    ap.page.hidden = false;
    ap.wake.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(750);
    expect(a.act).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(a.act).toHaveBeenCalledOnce();
  } finally {
    stopA();
    sibling.dispose();
    a.dispose();
  }
});

it('a reloaded page learns older activity, and an unanswered probe has a fixed deadline', async () => {
  const b = bus();
  const old = b.create();
  const activity = createAccountActivity(() => {}, old);
  const a = vaultEnv({ encrypted: true, locked: false });
  let stopA = () => {};
  try {
    old.page.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.advanceTimersByTimeAsync(70_000);
    a.env.settings.patch({ lockIdle: 1 });
    const fresh = b.create();
    stopA = createIdleLock(a.env.engine, a.env.settings, fresh);
    await vi.advanceTimersByTimeAsync(10);
    activity.dispose();
    await vi.advanceTimersByTimeAsync(740);
    expect(a.act).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    expect(a.act).toHaveBeenCalledOnce();
  } finally {
    stopA();
    activity.dispose();
    a.dispose();
  }
});

it('ignores malformed/future timestamps and releases messages, listeners and timers on dispose', async () => {
  const b = bus();
  const a = vaultEnv({ encrypted: true, locked: false });
  const peer = b.create();
  a.env.settings.patch({ lockIdle: 1 });
  const stop = createIdleLock(a.env.engine, a.env.settings, peer);
  try {
    peer.page.dispatchEvent(new KeyboardEvent('keydown'));
    await vi.advanceTimersByTimeAsync(59_000);
    for (const at of [NaN, Infinity, -1, Date.now() + 100_000, 'later', null])
      b.inject({ t: 'activity', at });
    b.inject({ t: 'unexpected', at: Date.now() });
    await vi.advanceTimersByTimeAsync(1750);
    expect(a.act).toHaveBeenCalledOnce();
    stop();
    expect(peer.closed()).toBe(true);
    const n = b.sent.length;
    peer.page.dispatchEvent(new KeyboardEvent('keydown'));
    peer.wake.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(b.sent).toHaveLength(n);
    expect(a.act).toHaveBeenCalledOnce();
  } finally {
    stop();
    a.dispose();
  }
});

it('coalesces pointer messages and shares only the timestamp envelope', async () => {
  const b = bus();
  const peer = b.create();
  const activity = createAccountActivity(() => {}, peer);
  try {
    await tick();
    b.sent.length = 0;
    for (let i = 0; i < 1000; i++) peer.page.dispatchEvent(new Event('pointermove'));
    expect(b.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(b.sent).toHaveLength(2);
    for (const message of b.sent)
      expect(Object.keys(message as object).sort()).toEqual(['at', 't']);
    activity.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(b.sent).toHaveLength(2);
  } finally {
    activity.dispose();
  }
});
