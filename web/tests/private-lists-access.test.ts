import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmAccess } from '../src/engine/client-dm-access.ts';
import { createPrivateListClient } from '../src/engine/client-private-lists.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { BACKGROUND_INTERVAL_MS } from '../src/engine/signer-orchestrator.ts';
import { account, deferred, PUBKEY, tick } from './vault-ui-fixture.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  });
});
afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
  vi.useRealTimers();
});
const request = (req: string, list = true): Extract<FromEngine, { t: 'crypt' }> => ({
  t: 'crypt',
  req,
  pubkey: PUBKEY,
  peer: PUBKEY,
  operation: 'nip44.decrypt',
  data: 'ciphertext fixture',
  ...(list
    ? { context: { kind: 'private-list' as const, sub: 'list', event: 'e'.repeat(64) } }
    : {}),
});
function fixture() {
  const out: ToEngine[] = [],
    access = createDmAccess((m) => out.push(m));
  const who = account({ signer: 'extension' });
  access.accounts([who]);
  const lists = createPrivateListClient(access, (m) => out.push(m));
  return { out, access, who, lists };
}
async function paint(): Promise<void> {
  vi.advanceTimersToNextFrame();
  vi.advanceTimersToNextFrame();
  await tick();
}
it('private lists require an opted-in visible view and never read or write DM consent', async () => {
  const { out, access, who, lists } = fixture();
  const decrypt = vi.fn(async () => '[["word","private"]]');
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  lists.open('list', { source: 'mutes', account: PUBKEY });
  lists.visible('list', true);
  lists.crypt(request('old'));
  await tick();
  expect(decrypt).not.toHaveBeenCalled();
  lists.open('list', { source: 'mutes', account: PUBKEY, privateLists: true });
  lists.crypt(request('hidden'));
  await tick();
  expect(decrypt).not.toHaveBeenCalled();
  lists.visible('list', true);
  const pending = lists.crypt(request('visible'));
  await paint();
  await pending;
  expect(decrypt).toHaveBeenCalledTimes(1);
  expect(out).toContainEqual({ t: 'crypted', req: 'visible', value: '[["word","private"]]' });
  expect(access.status(who)).toBe('ask');
  expect(localStorage.getItem(`lkjstr:dm-ok:${PUBKEY}`)).toBeNull();
  expect(JSON.stringify(localStorage)).not.toContain('private');
  lists.dispose();
  access.dispose();
});
it('Messages refusal and list refusal are separate while sharing one signer queue', async () => {
  const { out, access, who } = fixture();
  access.allow(PUBKEY);
  const first = deferred<string>(),
    decrypt = vi.fn(() => first.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  const dm = access.crypt(request('dm', false)),
    list = access.crypt(request('list'));
  await vi.waitFor(() => expect(decrypt).toHaveBeenCalledTimes(1));
  first.resolve(Promise.reject(Error('refused')) as unknown as string);
  await Promise.all([dm, list]);
  expect(decrypt).toHaveBeenCalledTimes(2);
  expect(access.status(who)).toBe('refused');
  access.retry(PUBKEY);
  decrypt.mockResolvedValue('new DM');
  await access.crypt(request('new', false));
  expect(out).toContainEqual({ t: 'crypted', req: 'new', value: 'new DM' });
  expect(access.status(who)).toBe('ready');
  access.dispose();
});
it('hide cancels active and queued list prompts and ignores late plaintext after reopen', async () => {
  const { out, access, lists } = fixture();
  const late = deferred<string>(),
    decrypt = vi.fn(() => late.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  lists.open('list', { source: 'mutes', account: PUBKEY, privateLists: true });
  lists.visible('list', true);
  const old = lists.crypt(request('old')),
    queued = lists.crypt(request('queued'));
  await paint();
  await vi.waitFor(() => expect(decrypt).toHaveBeenCalledTimes(1));
  lists.visible('list', false);
  await Promise.all([old, queued]);
  lists.visible('list', true);
  decrypt.mockResolvedValue('current');
  const current = lists.crypt(request('new'));
  await paint();
  expect(decrypt).toHaveBeenCalledTimes(1);
  late.resolve('stale private text');
  await vi.advanceTimersByTimeAsync(BACKGROUND_INTERVAL_MS);
  await current;
  expect(decrypt).toHaveBeenCalledTimes(2);
  expect(out.filter((m) => m.t === 'crypted' && ['old', 'queued'].includes(m.req))).toEqual([]);
  expect(out).toContainEqual({ t: 'crypted', req: 'new', value: 'current' });
  lists.dispose();
  access.dispose();
});
it('explicit worker cancellation and account revocation consume old list answers', async () => {
  const { out, access, lists } = fixture();
  const late = deferred<string>(),
    decrypt = vi.fn(() => late.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  lists.open('list', { source: 'mutes', account: PUBKEY, privateLists: true });
  lists.visible('list', true);
  lists.crypt(request('cancelled'));
  await paint();
  lists.cancel('cancelled');
  await tick();
  lists.crypt(request('locked'));
  await paint();
  access.accounts([account({ signer: 'extension', locked: true })]);
  late.resolve('late');
  await tick();
  expect(out.filter((m) => m.t === 'crypted' && 'value' in m)).toEqual([]);
  lists.dispose();
  access.dispose();
});
it('list signer timeout releases the shared queue without changing DM consent or refusal', async () => {
  const { out, access, who } = fixture();
  const late = deferred<string>(),
    decrypt = vi.fn(() => late.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  const pending = access.crypt(request('deadline'));
  await tick();
  await vi.advanceTimersByTimeAsync(60_000);
  await pending;
  expect(out).toContainEqual({ t: 'crypted', req: 'deadline', error: 'signer-timeout' });
  expect(access.status(who)).toBe('ask');
  access.allow(PUBKEY);
  decrypt.mockResolvedValue('DM');
  await access.crypt(request('after', false));
  expect(out).toContainEqual({ t: 'crypted', req: 'after', value: 'DM' });
  late.resolve('late');
  await tick();
  expect(out.filter((m) => m.t === 'crypted' && m.req === 'deadline')).toHaveLength(1);
  access.dispose();
});
it('duplicate requests cannot remove ownership of the original hidden-view cancellation', async () => {
  const { out, access, lists } = fixture();
  const late = deferred<string>(),
    decrypt = vi.fn(() => late.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  lists.open('list', { source: 'mutes', account: PUBKEY, privateLists: true });
  lists.visible('list', true);
  const original = lists.crypt(request('same'));
  await paint();
  await vi.waitFor(() => expect(decrypt).toHaveBeenCalledTimes(1));
  await lists.crypt(request('same'));
  lists.visible('list', false);
  await original;
  await lists.crypt(request('hidden-race'));
  late.resolve('late');
  await tick();
  expect(decrypt).toHaveBeenCalledTimes(1);
  expect(out).toEqual([]);
  lists.dispose();
  access.dispose();
});
