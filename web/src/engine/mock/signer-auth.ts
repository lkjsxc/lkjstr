// Explicit mock authorization intents only; no RPC, credential or cryptographic success is simulated.

import type { Failure, FromEngine, SignerAuthorization, ToEngine } from '../protocol.ts';
import { allowedAuthUrl } from './signer-auth-url.ts';
export function createSignerAuthMock(post: (message: FromEngine) => void, now = Date.now) {
  const jobs = new Map<
    string,
    {
      intent: SignerAuthorization;
      seen: Set<string>;
      timer: ReturnType<typeof setTimeout>;
      done(error?: Failure['code']): void;
    }
  >(); // at most 16 fixture calls
  function finish(id: string, error?: Failure['code']): void {
    const job = jobs.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    jobs.delete(id);
    post({ t: 'signer.auth.clear', id });
    job.done(error);
  }
  return {
    start(
      input: Omit<SignerAuthorization, 'id' | 'expiresAt'>,
      done: (error?: Failure['code']) => void,
    ) {
      if (!allowedAuthUrl(input.url)) {
        done('signer-refused');
        return undefined;
      }
      if (jobs.size >= 16) {
        done('too-large');
        return undefined;
      }
      const id = `mock-bunker-${crypto.randomUUID()}`;
      const intent = { ...input, id, expiresAt: now() + 60_000 };
      const timer = setTimeout(
        () => finish(id, input.method.startsWith('nip') ? 'signer-timeout' : 'signer-missing'),
        60_000,
      );
      jobs.set(id, { intent, seen: new Set([input.url]), timer, done });
      post({ t: 'signer.auth', ...intent });
      return id;
    },
    challenge(id: string, url: string) {
      const job = jobs.get(id);
      if (!job || job.seen.has(url)) return;
      if (!allowedAuthUrl(url)) {
        finish(id, 'signer-refused');
        return;
      }
      if (job.seen.size >= 4) {
        finish(id, 'too-large');
        return;
      }
      job.seen.add(url);
      job.intent = { ...job.intent, url };
      post({ t: 'signer.auth', ...job.intent });
    },
    finish,
    observe(message: FromEngine): void {
      if (message.t !== 'accounts') return;
      for (const [id, job] of jobs)
        if (
          job.intent.account &&
          !message.accounts.some(
            (a) => a.author.pubkey === job.intent.account && a.signer === 'remote' && !a.locked,
          )
        )
          finish(id, 'offline');
    },
    handle(message: ToEngine): boolean {
      if (message.t !== 'signer.auth.cancel') return false;
      finish(message.id, message.reason === 'unsupported' ? 'unsupported' : 'signer-refused');
      return true;
    },
    dispose(): void {
      for (const job of jobs.values()) clearTimeout(job.timer);
      jobs.clear();
    },
  };
}
