import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { type ActResult, createEngine, type Transport } from '../src/engine/client.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { createDmDraftStore } from '../src/views/dm-draft-store.ts';
import { dmEnv, OTHER } from './dm-ui-fixture.ts';
import { account, deferred, failure, PUBKEY, success, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});
it('restores private input and retained rows only from the engine and carries each acknowledged revision', async () => {
  const x = dmEnv(),
    error = vi.fn();
  x.act.mockResolvedValueOnce(
    success({
      dmDraftRevision: 'opaque-one',
      dmDraft: {
        draft: { recipients: [OTHER], text: 'saved private input' },
        failed: [{ key: 'retained', draft: { recipients: [OTHER], text: 'maybe delivered' } }],
      },
    }),
  );
  const store = createDmDraftStore({
    env: x.env,
    account: PUBKEY,
    recipients: [OTHER],
    changed() {},
    failed: error,
  });
  try {
    await tick();
    await tick();
    expect(store.get().draft.text).toBe('saved private input');
    expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.send')).toHaveLength(0);
    x.act.mockResolvedValueOnce(success({ dmDraftRevision: 'opaque-two' }));
    store.draft({ recipients: [OTHER], text: 'new private input' });
    await store.flush();
    expect(x.act.mock.calls.at(-1)?.[0]).toMatchObject({
      a: 'dm.draft.save',
      expected: 'opaque-one',
    });
    store.draft({ recipients: [OTHER], text: 'newer private input' });
    await store.flush();
    expect(x.act.mock.calls.at(-1)?.[0]).toMatchObject({ expected: 'opaque-two' });
    expect(JSON.stringify(localStorage)).not.toContain('private input');
  } finally {
    store.dispose();
    x.dispose();
  }
});
it('an old save acknowledgement cannot replace a newer edit, and a stale rejection preserves it', async () => {
  const x = dmEnv(),
    error = vi.fn(),
    waiting = deferred<ActResult>();
  const store = createDmDraftStore({
    env: x.env,
    account: PUBKEY,
    recipients: [OTHER],
    changed() {},
    failed: error,
  });
  try {
    await tick();
    await tick();
    x.act.mockReturnValueOnce(waiting.promise).mockResolvedValueOnce(failure('rejected'));
    store.draft({ recipients: [OTHER], text: 'first version' });
    const saving = store.flush();
    store.draft({ recipients: [OTHER], text: 'second version' });
    waiting.resolve(success({ dmDraftRevision: 'old-ack' }));
    expect(await saving).toBe(false);
    expect(store.get().draft.text).toBe('second version');
    expect(error).toHaveBeenCalledWith({ code: 'rejected' });
  } finally {
    store.dispose();
    x.dispose();
  }
});
it('late load after revocation never restores plaintext or calls a disposed editor', async () => {
  const x = dmEnv(),
    waiting = deferred<ActResult>(),
    changed = vi.fn();
  x.act.mockReturnValueOnce(waiting.promise);
  const store = createDmDraftStore({
    env: x.env,
    account: PUBKEY,
    recipients: [OTHER],
    changed,
    failed() {},
  });
  await tick();
  changed.mockClear();
  x.accounts.set({ active: PUBKEY, accounts: [account({ locked: true })] });
  store.dispose();
  waiting.resolve(
    success({ dmDraft: { draft: { recipients: [OTHER], text: 'late secret' }, failed: [] } }),
  );
  await tick();
  expect(store.get().draft.text).toBe('');
  expect(changed).not.toHaveBeenCalled();
  x.dispose();
});
it('disposal flushes the latest coalesced text rather than only the older in-flight write', async () => {
  const x = dmEnv(),
    waiting = deferred<ActResult>();
  const store = createDmDraftStore({
    env: x.env,
    account: PUBKEY,
    recipients: [OTHER],
    changed() {},
    failed() {},
  });
  await tick();
  await tick();
  x.act.mockReturnValueOnce(waiting.promise);
  store.draft({ recipients: [OTHER], text: 'first' });
  const saving = store.flush();
  store.draft({ recipients: [OTHER], text: 'last before close' });
  store.dispose();
  waiting.resolve(success({ dmDraftRevision: 'first-committed' }));
  await saving;
  await tick();
  expect(x.act.mock.calls.filter(([a]) => a.a === 'dm.draft.save').at(-1)?.[0]).toMatchObject({
    state: { draft: { text: 'last before close' } },
  });
  x.dispose();
});
it('does not dispatch lock before an encrypted flush acknowledges, or after its 15-second deadline', async () => {
  vi.useFakeTimers();
  const sent: ToEngine[] = [];
  let receive: (message: FromEngine) => void = () => {};
  const transport: Transport = {
    post: (m) => sent.push(m),
    listen: (fn) => {
      receive = fn;
    },
    close() {},
  };
  const engine = createEngine(transport),
    pending = deferred<boolean>();
  receive({ t: 'accounts', accounts: [account({ encrypted: true })], active: PUBKEY });
  const off = engine.dm?.flushers.add(PUBKEY, () => pending.promise);
  const locking = engine.act({ a: 'account.lock', pubkey: PUBKEY });
  await tick();
  expect(sent.some((m) => m.t === 'act')).toBe(false);
  await vi.advanceTimersByTimeAsync(15000);
  expect((await locking).ok).toBe(false);
  pending.resolve(true);
  await tick();
  expect(sent.some((m) => m.t === 'act')).toBe(false);
  off?.();
  engine.dispose();
});
