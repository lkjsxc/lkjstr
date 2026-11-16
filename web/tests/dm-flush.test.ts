import { afterEach, expect, it, vi } from 'vitest';
import { createEngine, type Transport } from '../src/engine/client.ts';
import { createDmFlushers } from '../src/engine/client-dm-flush.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { deferred, tick } from './vault-ui-fixture.ts';

afterEach(() => vi.useRealTimers());
it('holds immediately, serializes writers only after prepare, and releases only the matching lease', async () => {
  const sent: ToEngine[] = [],
    first = deferred<boolean>(),
    second = vi.fn(async () => true);
  const holds: boolean[] = [],
    manager = createDmFlushers((m) => sent.push(m));
  const hooks = { hold: (on: boolean) => holds.push(on), suspend() {}, register: async () => true };
  manager.add('a', () => first.promise, hooks);
  manager.add('a', second, hooks);
  manager.receive({ t: 'dm.flush', req: 'lock', account: 'a', phase: 'hold' });
  expect(holds.at(-1)).toBe(true);
  manager.resume(8);
  await tick();
  expect(second).not.toHaveBeenCalled();
  expect(sent).toEqual([]);
  manager.receive({ t: 'dm.flush', req: 'lock', account: 'a', phase: 'prepare' });
  expect(second).not.toHaveBeenCalled();
  first.resolve(true);
  await tick();
  await tick();
  expect(second).toHaveBeenCalledTimes(1);
  expect(sent).toEqual([{ t: 'dm.flushed', req: 'lock', ok: true }]);
  manager.receive({ t: 'dm.flush', req: 'other', account: 'a', phase: 'release' });
  expect(holds.at(-1)).toBe(true);
  manager.receive({ t: 'dm.flush', req: 'lock', account: 'a', phase: 'release' });
  expect(holds.at(-1)).toBe(false);
  manager.dispose();
});
it('times out once without releasing an editor or accepting a late success', async () => {
  vi.useFakeTimers();
  const sent: ToEngine[] = [],
    pending = deferred<boolean>(),
    held = vi.fn();
  const manager = createDmFlushers((m) => sent.push(m));
  manager.add('a', () => pending.promise, { hold: held, suspend() {}, register: async () => true });
  manager.receive({ t: 'dm.flush', req: 'slow', account: 'a', phase: 'prepare' });
  await vi.advanceTimersByTimeAsync(15_000);
  expect(sent).toEqual([{ t: 'dm.flushed', req: 'slow', ok: false }]);
  expect(held).toHaveBeenLastCalledWith(true);
  pending.resolve(true);
  await tick();
  expect(sent).toHaveLength(1);
  manager.dispose();
});
it('suspends on reconnect and ignores a previous registration or flush completion', async () => {
  const sent: ToEngine[] = [],
    registrations = [deferred<boolean>(), deferred<boolean>()];
  let receive: (m: FromEngine) => void = () => {};
  const transport: Transport = {
    post: (m) => sent.push(m),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  };
  const engine = createEngine(transport),
    hold = vi.fn(),
    suspend = vi.fn();
  let at = 0;
  engine.dm?.flushers.add('a', async () => true, {
    hold,
    suspend,
    register: () => registrations[at++]!.promise,
  });
  receive({ t: 'ready', engine: 'fixture', version: 8 });
  receive({ t: 'reconnect' });
  expect(hold).toHaveBeenLastCalledWith(true);
  registrations[0]?.resolve(true);
  await tick();
  await tick();
  expect(hold).toHaveBeenLastCalledWith(true);
  receive({ t: 'ready', engine: 'fixture', version: 8 });
  registrations[1]?.resolve(true);
  await tick();
  await tick();
  expect(hold).toHaveBeenLastCalledWith(false);
  expect(suspend).toHaveBeenCalledTimes(3);
  engine.dispose();
});
