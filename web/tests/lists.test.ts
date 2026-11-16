import { expect, it, vi } from 'vitest';
import type { Row } from '../src/engine/protocol.ts';
import { createSignal } from '../src/shared/signal.ts';
import { watchList } from '../src/views/lists.ts';
import type { ViewEnv } from '../src/views/registry.ts';

it('finite Settings lists collect every page past 500 and replace stale membership', async () => {
  const row = (i: number) => ({ kind: 'mute', key: `mute:${i}` }) as Row;
  let receive: (r: readonly Row[], top: boolean, bottom: boolean) => void = () => {};
  const window = vi.fn();
  const draw = vi.fn();
  const env = {
    visible: createSignal(true),
    engine: {
      me: () => 'owner',
      accounts: createSignal({ accounts: [] }),
      open: (_: unknown, handlers: { rows: typeof receive }) => {
        receive = handlers.rows;
        return { window, visible() {}, close() {} };
      },
    },
  } as unknown as ViewEnv;
  const stop = watchList(env, 'mutes', draw);
  receive(
    Array.from({ length: 50 }, (_, i) => row(i)),
    true,
    false,
  );
  await Promise.resolve();
  expect(window).toHaveBeenLastCalledWith('top', 0, 500);
  receive(
    Array.from({ length: 500 }, (_, i) => row(i)),
    true,
    false,
  );
  await Promise.resolve();
  expect(window).toHaveBeenLastCalledWith({ key: 'mute:499' }, 0, 500);
  receive(
    Array.from({ length: 151 }, (_, i) => row(i + 499)),
    false,
    true,
  );
  expect(draw.mock.lastCall?.[0]).toHaveLength(650);
  // A live membership update restarts collection, so removed earlier rows vanish.
  receive([row(649)], false, true);
  await Promise.resolve();
  expect(window).toHaveBeenLastCalledWith('top', 0, 500);
  receive([row(649)], true, true);
  expect(draw.mock.lastCall?.[0]).toEqual([row(649)]);
  stop();
});

it('coalesces a burst of Settings updates into one complete refresh', async () => {
  const row = (i: number) => ({ kind: 'mute', key: `mute:${i}` }) as Row;
  let receive: (r: readonly Row[], top: boolean, bottom: boolean) => void = () => {};
  let patch: () => void = () => {};
  const window = vi.fn();
  const draw = vi.fn();
  const env = {
    visible: createSignal(true),
    engine: {
      me: () => 'owner',
      accounts: createSignal({ accounts: [] }),
      open: (_: unknown, handlers: { rows: typeof receive; patch: () => void }) => {
        receive = handlers.rows;
        patch = handlers.patch;
        return { window, visible() {}, close() {} };
      },
    },
  } as unknown as ViewEnv;
  const stop = watchList(env, 'mutes', draw);
  await Promise.resolve();
  receive([row(0)], true, true);
  window.mockClear();
  for (let i = 0; i < 100; i++) patch();
  await Promise.resolve();
  expect(window.mock.calls).toEqual([['top', 0, 500]]);
  receive(
    Array.from({ length: 500 }, (_, i) => row(i)),
    true,
    false,
  );
  await Promise.resolve();
  receive(
    Array.from({ length: 151 }, (_, i) => row(i + 499)),
    false,
    true,
  );
  expect(draw.mock.lastCall?.[0]).toHaveLength(650);
  patch();
  stop();
  await Promise.resolve();
  expect(window).toHaveBeenCalledTimes(2);
});
