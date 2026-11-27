// Reading consent is a device preference. Refusal and private crypto queues last only this page session.
import { createSignal } from '../shared/signal.ts';
import { kv } from '../shared/storage.ts';
import { createExtensionDecrypts } from './client-dm-decrypt.ts';
import type { Account, FromEngine, ToEngine } from './protocol.ts';
import { createSignerOrchestrator } from './signer-orchestrator.ts';

type Crypt = Extract<FromEngine, { t: 'crypt' }>;
type CryptError = NonNullable<Extract<ToEngine, { t: 'crypted' }>['error']>;
type Gate =
  | 'ready'
  | 'signed-out'
  | 'read-only'
  | 'locked'
  | 'ask'
  | 'refused'
  | 'unsupported'
  | 'timeout';
export function createDmAccess(
  post: (message: ToEngine) => void,
  orchestrator = createSignerOrchestrator(),
) {
  const changed = createSignal(0);
  const failures = new Map<string, 'refused' | 'unsupported' | 'timeout'>(); // bounded by the accounts owned by this client
  const epochs = new Map<string, number>();
  const listEpochs = new Map<string, number>();
  // At most 16 queued or active requests, with a shared byte budget.
  const requests = new Map<string, { account: string; abort: AbortController }>();
  const cancel = (req: string): void => requests.get(req)?.abort.abort();
  const accounts = new Map<string, Account>();
  const decrypt = createExtensionDecrypts(orchestrator);
  let sequence = 0,
    bytes = 0,
    stopped = false;
  const notify = (): void => changed.set(changed.get() + 1);
  const epoch = (pubkey: string): number => epochs.get(pubkey) ?? 0;
  const revoke = (pubkey: string): void => {
    epochs.set(pubkey, ++sequence);
  };
  const block = (pubkey: string, error: string): void => {
    if (error !== 'signer-refused' && error !== 'unsupported' && error !== 'signer-timeout') return;
    const value =
      error === 'unsupported' ? 'unsupported' : error === 'signer-timeout' ? 'timeout' : 'refused';
    if (failures.get(pubkey) === value) return;
    failures.set(pubkey, value);
    revoke(pubkey);
    notify();
  };
  const status = (account: Account | undefined): Gate => {
    if (!account) return 'signed-out';
    if (account.signer === 'none') return 'read-only';
    if (account.locked) return 'locked';
    const failed = failures.get(account.author.pubkey);
    if (failed) return failed;
    return account.signer === 'local' || kv.get(`dm-ok:${account.author.pubkey}`) === true
      ? 'ready'
      : 'ask';
  };
  return {
    changed,
    status,
    block,
    pause: revoke,
    allow(pubkey: string): void {
      kv.set(`dm-ok:${pubkey}`, true);
      notify();
    },
    retry(pubkey: string): void {
      failures.delete(pubkey);
      revoke(pubkey);
      notify();
    },
    accounts(next: readonly Account[]): void {
      const keys = new Set(next.map((a) => a.author.pubkey));
      for (const [pubkey, old] of accounts) {
        const current = next.find((a) => a.author.pubkey === pubkey);
        if (!current || current.locked !== old.locked || current.signer !== old.signer) {
          revoke(pubkey);
          listEpochs.set(pubkey, ++sequence);
          for (const [req, request] of requests) if (request.account === pubkey) cancel(req);
        }
        if (!keys.has(pubkey)) {
          accounts.delete(pubkey);
          failures.delete(pubkey);
        }
      }
      for (const account of next) accounts.set(account.author.pubkey, account);
      for (const pubkey of epochs.keys())
        if (!keys.has(pubkey) && ![...requests.values()].some((r) => r.account === pubkey)) {
          epochs.delete(pubkey);
          listEpochs.delete(pubkey);
        }
    },
    cancel,
    async crypt(message: Crypt, writing = () => false): Promise<void> {
      const { pubkey, req, data, context, background } = message;
      if (stopped || requests.has(req)) return;
      const list = context?.kind === 'private-list';
      const currentEpoch = (): number => (list ? (listEpochs.get(pubkey) ?? 0) : epoch(pubkey));
      const lease = currentEpoch();
      const abort = new AbortController();
      const failure = (error: CryptError): void => {
        if (!stopped && !abort.signal.aborted) post({ t: 'crypted', req, error });
      };
      if (background && writing()) return failure('rate-limited');
      if (requests.size >= 16 || bytes + data.length > 2_800_000) return failure('too-large');
      const current = (): void => {
        if (background && writing()) throw new Error('rate-limited');
        if (currentEpoch() !== lease) throw new Error('signer-refused');
        const account = accounts.get(pubkey);
        if (!account || account.locked || account.signer === 'none')
          throw new Error('signer-missing');
        if (list) return;
        const denied = failures.get(pubkey);
        if (denied)
          throw new Error(
            denied === 'timeout'
              ? 'signer-timeout'
              : denied === 'unsupported'
                ? denied
                : 'signer-refused',
          );
        if (status(account) === 'ask') throw new Error('signer-refused');
      };
      requests.set(req, { account: pubkey, abort });
      bytes += data.length;
      try {
        current();
        const value = await decrypt(
          message,
          message.weight ?? (list ? 1 : background ? 2 : 8),
          lease,
          current,
          abort.signal,
        );
        if (!stopped && !abort.signal.aborted) {
          current();
          post({ t: 'crypted', req, value });
        }
      } catch (cause) {
        const code = cause instanceof Error ? cause.message : '';
        if (stopped || abort.signal.aborted || code === 'cancelled') return;
        const error: CryptError =
          code === 'unsupported' ||
          code === 'signer-missing' ||
          code === 'signer-timeout' ||
          code === 'too-large' ||
          code === 'rate-limited'
            ? code
            : 'signer-refused';
        failure(error);
        if (!list && currentEpoch() === lease && status(accounts.get(pubkey)) === 'ready')
          block(pubkey, error);
      } finally {
        requests.delete(req);
        bytes -= data.length;
        if (!accounts.has(pubkey) && ![...requests.values()].some((r) => r.account === pubkey)) {
          epochs.delete(pubkey);
          listEpochs.delete(pubkey);
        }
      }
    },
    dispose(): void {
      stopped = true;
      for (const req of requests.keys()) cancel(req);
      failures.clear();
      accounts.clear();
      epochs.clear();
      listEpochs.clear();
      requests.clear();
    },
  };
}
