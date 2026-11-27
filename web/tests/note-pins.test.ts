import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Account, NoteRow } from '../src/engine/protocol.ts';
import { actionRow } from '../src/views/note-actions.ts';
import { note } from './public-snapshots-support.ts';
import { account, deferred, failure, PUBKEY, success, tick, vaultEnv } from './vault-ui-fixture.ts';

const cleanup: (() => void)[] = [];
const owned = (pinned = false): NoteRow => ({
  ...note(),
  author: account().author,
  mine: { own: true, bookmarked: false, reposted: false, pinned },
});
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(fn, 16));
});
afterEach(() => {
  window.dispatchEvent(new Event('blur'));
  for (const dispose of cleanup.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function menu(row = owned(), extra: Partial<Account> = {}, version = 18) {
  const fixture = vaultEnv(extra, version);
  cleanup.push(fixture.dispose);
  const actions = actionRow(row, fixture.env);
  if (actions) fixture.el.append(actions);
  fixture.el.querySelector<HTMLButtonElement>('.a-more')?.click();
  const item = (label: string) =>
    [...fixture.env.layer.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
      (button) => button.textContent === label,
    );
  return { ...fixture, item };
}

it.each([false, true])(
  'sends one %s membership change and a fresh inverse on Undo',
  async (pinned) => {
    const f = menu(owned(pinned));
    f.item(pinned ? 'Unpin' : 'Pin')!.click();
    await tick();
    expect(f.act).toHaveBeenCalledExactlyOnceWith({
      a: 'pin',
      as: PUBKEY,
      id: owned().id,
      on: !pinned,
    });
    expect(f.env.layer.querySelector('.toast.undo')?.textContent).toContain(
      pinned ? 'Note unpinned' : 'Note pinned',
    );
    f.env.layer.querySelector<HTMLButtonElement>('.toast.undo button')!.click();
    await tick();
    expect(f.act.mock.calls.map(([action]) => action)).toEqual([
      { a: 'pin', as: PUBKEY, id: owned().id, on: !pinned },
      { a: 'pin', as: PUBKEY, id: owned().id, on: pinned },
    ]);
  },
);

it.each([
  ['another author', { ...owned(), mine: { ...owned().mine, own: false } }, {}, 18],
  ['article', { ...owned(), eventKind: 30023 }, {}, 18],
  ['channel message', { ...owned(), channel: { id: 'room', name: 'Room' } }, {}, 18],
  ['read-only account', owned(), { signer: 'none' }, 18],
  ['older engine', owned(), {}, 17],
] as const)('omits Pin for %s', (_name, row, extra, version) => {
  const f = menu(row, extra, version);
  expect(f.item('Pin')).toBeUndefined();
  expect(f.item('Unpin')).toBeUndefined();
  expect(f.act).not.toHaveBeenCalled();
});

it('shows stale-list failure without offering a successful Undo', async () => {
  const f = menu();
  f.act.mockResolvedValue(failure('stale-list'));
  f.item('Pin')!.click();
  await tick();
  expect(f.env.layer.querySelector('.toast:not(.undo)')?.textContent).toBe(
    'The pinned list changed. Try again.',
  );
  expect(f.env.layer.querySelector('.toast.undo')).toBeNull();
});

it('does not redirect an open menu or a previous Undo after switching accounts', async () => {
  const other = account({ author: { ...account().author, pubkey: 'b'.repeat(64) } });
  const open = menu();
  open.accounts.set({ active: other.author.pubkey, accounts: [account(), other] });
  open.item('Pin')!.click();
  await tick();
  expect(open.act).not.toHaveBeenCalled();

  const done = menu(owned(true));
  done.item('Unpin')!.click();
  await tick();
  const undo = done.env.layer.querySelector<HTMLButtonElement>('.toast.undo button')!;
  done.accounts.set({ active: other.author.pubkey, accounts: [account(), other] });
  undo.click();
  await tick();
  expect(done.act).toHaveBeenCalledTimes(1);
});

it('does not leave an Undo if the account changes while the signer is pending', async () => {
  const f = menu();
  const signing = deferred<ReturnType<typeof success>>();
  f.act.mockReturnValue(signing.promise);
  f.item('Pin')!.click();
  const other = account({ author: { ...account().author, pubkey: 'b'.repeat(64) } });
  f.accounts.set({ active: other.author.pubkey, accounts: [account(), other] });
  signing.resolve(success());
  await tick();
  expect(f.act).toHaveBeenCalledExactlyOnceWith({
    a: 'pin',
    as: PUBKEY,
    id: owned().id,
    on: true,
  });
  expect(f.env.layer.querySelector('.toast.undo')).toBeNull();
});
