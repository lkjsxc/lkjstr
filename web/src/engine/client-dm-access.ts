// Reading consent is a device preference. Refusal and private crypto queues last only this page session.
import { createSignal } from '../shared/signal.ts';
import { kv } from '../shared/storage.ts';
import { answerCrypt } from './client-crypto.ts';
import type { Account, FromEngine, ToEngine } from './protocol.ts';

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
export function createDmAccess(post: (message: ToEngine) => void) {
  const changed = createSignal(0);
  const failures = new Map<string, 'refused' | 'unsupported' | 'timeout'>(); // bounded by the accounts owned by this client
  const epochs = new Map<string, number>();
  const accounts = new Map<string, Account>();
  const waits = new Set<() => void>(); // <=16 bounded crypto calls; released on dispose or deadline
  const chains = new Map<string, { tail: Promise<void>; count: number }>(); // <=16 queued requests overall
  let sequence = 0,
    pending = 0,
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
        if (!current || current.locked !== old.locked || current.signer !== old.signer)
          revoke(pubkey);
        if (!keys.has(pubkey)) {
          accounts.delete(pubkey);
          failures.delete(pubkey);
        }
      }
      for (const account of next) accounts.set(account.author.pubkey, account);
      for (const pubkey of epochs.keys())
        if (!keys.has(pubkey) && !chains.has(pubkey)) epochs.delete(pubkey);
    },
    async crypt(message: Crypt): Promise<void> {
      if (stopped) return;
      const failure = (error: CryptError): void => {
        if (!stopped) post({ t: 'crypted', req: message.req, error });
      };
      if (pending >= 16 || bytes + message.data.length > 2_800_000) return failure('too-large');
      const lease = epoch(message.pubkey);
      const chain = chains.get(message.pubkey) ?? { tail: Promise.resolve(), count: 0 };
      chains.set(message.pubkey, chain);
      chain.count++;
      pending++;
      bytes += message.data.length;
      const run = chain.tail.then(async () => {
        if (stopped) return;
        if (epoch(message.pubkey) !== lease) return failure('signer-refused');
        const denied = failures.get(message.pubkey);
        if (denied)
          return failure(
            denied === 'unsupported'
              ? 'unsupported'
              : denied === 'timeout'
                ? 'signer-timeout'
                : 'signer-refused',
          );
        const account = accounts.get(message.pubkey);
        if (!account || account.locked || account.signer === 'none')
          return failure('signer-missing');
        if (status(account) === 'ask') return failure('signer-refused');
        await new Promise<void>((resolve) => {
          let accepting = true;
          const finish = (reply?: Extract<ToEngine, { t: 'crypted' }>, latch = true): void => {
            if (!accepting) return;
            accepting = false;
            clearTimeout(timer);
            waits.delete(cancel);
            if (reply && !stopped) {
              post(reply);
              if (latch && reply.error && epoch(message.pubkey) === lease)
                block(message.pubkey, reply.error);
            }
            resolve();
          };
          const cancel = (): void => finish();
          const timer = setTimeout(
            () =>
              finish({
                t: 'crypted',
                req: message.req,
                error: epoch(message.pubkey) === lease ? 'signer-timeout' : 'signer-refused',
              }),
            60_000,
          );
          waits.add(cancel);
          void answerCrypt(message, (reply) => {
            if (epoch(message.pubkey) !== lease)
              finish({ t: 'crypted', req: message.req, error: 'signer-refused' }, false);
            else if (reply.t === 'crypted') finish(reply);
          });
        });
      });
      chain.tail = run.catch(() => {
        failure('signer-refused');
        if (!stopped && epoch(message.pubkey) === lease) block(message.pubkey, 'signer-refused');
      });
      try {
        await chain.tail;
      } finally {
        chain.count--;
        pending--;
        bytes -= message.data.length;
        if (!chain.count && chains.get(message.pubkey) === chain) {
          chains.delete(message.pubkey);
          if (!accounts.has(message.pubkey)) epochs.delete(message.pubkey);
        }
      }
    },
    dispose(): void {
      stopped = true;
      for (const cancel of waits) cancel();
      failures.clear();
      accounts.clear();
      epochs.clear();
    },
  };
}
