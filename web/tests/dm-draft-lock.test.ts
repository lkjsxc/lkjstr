import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { createDmDraftStore } from '../src/views/dm-draft-store.ts';
import { dmEnv, OTHER } from './dm-ui-fixture.ts';
import { account, deferred, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
function editor(x: ReturnType<typeof dmEnv>) {
  return createDmDraftStore({
    env: x.env,
    account: PUBKEY,
    recipients: [OTHER],
    changed() {},
    failed() {},
  });
}
it('does not read or edit before registration acknowledges', async () => {
  const x = dmEnv(),
    pending = deferred<ActResult>();
  x.editorAct.mockReturnValueOnce(pending.promise);
  const store = editor(x);
  try {
    await tick();
    expect(store.ready()).toBe(false);
    expect(x.act).not.toHaveBeenCalled();
    store.draft({ recipients: [OTHER], text: 'not accepted' });
    expect(store.get().draft.text).toBe('');
    pending.resolve(success());
    await tick();
    await tick();
    expect(store.ready()).toBe(true);
  } finally {
    store.dispose(true);
    x.dispose();
  }
});
it('holds the exact latest tail through archive and clean metadata acknowledgements', async () => {
  const x = dmEnv(),
    save = deferred<ActResult>(),
    clean = deferred<ActResult>(),
    store = editor(x);
  try {
    await tick();
    await tick();
    x.editorAct.mockImplementation((a) =>
      a.open && !a.dirty ? clean.promise : Promise.resolve(success()),
    );
    x.act.mockReturnValueOnce(save.promise);
    store.draft({ recipients: [OTHER], text: 'unsaved tail' });
    expect(x.editorAct.mock.calls.at(-1)?.[0]).toMatchObject({ dirty: true });
    expect(store.ready()).toBe(true);
    x.dm.flushers.receive({ t: 'dm.flush', req: 'lock', account: PUBKEY, phase: 'hold' });
    expect(store.ready()).toBe(false);
    store.draft({ recipients: [OTHER], text: 'held input' });
    expect(store.get().draft.text).toBe('unsaved tail');
    x.dm.flushers.receive({ t: 'dm.flush', req: 'lock', account: PUBKEY, phase: 'prepare' });
    expect(x.act.mock.calls.at(-1)?.[0]).toMatchObject({
      a: 'dm.draft.save',
      state: { draft: { text: 'unsaved tail' } },
    });
    expect(x.sent.some((m) => m.t === 'dm.flushed')).toBe(false);
    save.resolve(success({ dmDraftRevision: 'tail' }));
    await tick();
    await tick();
    expect(x.editorAct.mock.calls.at(-1)?.[0]).toMatchObject({ dirty: false });
    expect(x.sent.some((m) => m.t === 'dm.flushed')).toBe(false);
    clean.resolve(success());
    await tick();
    await tick();
    await tick();
    expect(x.sent).toContainEqual({ t: 'dm.flushed', req: 'lock', ok: true });
    x.accounts.set({ active: PUBKEY, accounts: [account({ locked: true })] });
    x.dm.flushers.receive({ t: 'dm.flush', req: 'lock', account: PUBKEY, phase: 'release' });
    expect(store.ready()).toBe(false);
  } finally {
    store.dispose(true);
    x.dispose();
  }
});
it.each([false, true])(
  'reconnect freezes a dirty=%s store and rebinds the same editor with current state',
  async (dirty) => {
    const x = dmEnv(),
      store = editor(x),
      resumed = deferred<ActResult>();
    try {
      await tick();
      await tick();
      const id = x.editorAct.mock.calls[0]?.[0].editor;
      if (dirty) store.draft({ recipients: [OTHER], text: 'retained' });
      x.dm.flushers.suspend();
      expect(store.ready()).toBe(false);
      store.draft({ recipients: [OTHER], text: 'blocked' });
      x.editorAct.mockReturnValueOnce(resumed.promise);
      x.dm.flushers.ready(8);
      expect(x.editorAct.mock.calls.at(-1)?.[0]).toMatchObject({ editor: id, dirty });
      expect(store.ready()).toBe(false);
      resumed.resolve(success());
      await tick();
      await tick();
      await tick();
      expect(store.ready()).toBe(true);
      expect(store.get().draft.text).toBe(dirty ? 'retained' : '');
    } finally {
      store.dispose(true);
      x.dispose();
    }
  },
);
it('disposal keeps its registration until the final draft is durably saved', async () => {
  const x = dmEnv(),
    store = editor(x),
    save = deferred<ActResult>();
  await tick();
  await tick();
  store.draft({ recipients: [OTHER], text: 'close tail' });
  x.act.mockReturnValueOnce(save.promise);
  store.dispose();
  await tick();
  expect(x.editorAct.mock.calls.some(([a]) => !a.open)).toBe(false);
  save.resolve(success({ dmDraftRevision: 'closed' }));
  for (let i = 0; i < 8; i++) await tick();
  expect(x.editorAct.mock.calls.at(-1)?.[0]).toMatchObject({ open: false });
  x.dispose();
});
it('a pending send fails the 15-second preparation and keeps its eventual terminal state', async () => {
  vi.useFakeTimers();
  const x = dmEnv(),
    store = editor(x),
    sent = deferred<void>();
  try {
    await tick();
    await tick();
    store.run('pending', async () => {
      await sent.promise;
      store.replace({
        ...store.get(),
        failed: [
          {
            key: 'pending',
            draft: { recipients: [OTHER], text: 'in flight' },
            error: { code: 'no-relays' },
            dmDelivery: { accepted: 1, total: 2 },
          },
        ],
      });
      await store.flush();
    });
    x.dm.flushers.receive({ t: 'dm.flush', req: 'slow-send', account: PUBKEY, phase: 'prepare' });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(x.sent.filter((m) => m.t === 'dm.flushed')).toEqual([
      { t: 'dm.flushed', req: 'slow-send', ok: false },
    ]);
    expect(store.ready()).toBe(false);
    sent.resolve();
    for (let i = 0; i < 12; i++) await tick();
    expect(store.get().failed[0]).toMatchObject({
      error: { code: 'no-relays' },
      dmDelivery: { accepted: 1, total: 2 },
    });
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.save').at(-1)?.[0]).toMatchObject({
      state: { failed: [{ key: 'pending', error: { code: 'no-relays' } }] },
    });
    expect(x.sent.filter((m) => m.t === 'dm.flushed')).toHaveLength(1);
    x.dm.flushers.receive({ t: 'dm.flush', req: 'slow-send', account: PUBKEY, phase: 'release' });
    expect(store.ready()).toBe(true);
  } finally {
    store.dispose(true);
    x.dispose();
  }
});
