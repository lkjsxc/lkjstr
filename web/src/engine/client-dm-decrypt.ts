// Coalesce identical decrypts only while an authorized consumer still owns the result.
import { cryptWithExtension } from './client-crypto.ts';
import type { FromEngine, SignerWeight } from './protocol.ts';
import type { ExtensionCall, SignerOrchestrator } from './signer-orchestrator.ts';

type Crypt = Extract<FromEngine, { t: 'crypt' }>;
type Flight = {
  message: Crypt;
  epoch: number;
  weight: SignerWeight;
  abort: AbortController;
  result: Promise<string>;
  consumers: number;
};

function same(a: Crypt, b: Crypt): boolean {
  return (
    a.pubkey === b.pubkey &&
    a.peer === b.peer &&
    a.operation === b.operation &&
    a.context?.sub === b.context?.sub &&
    a.context?.event === b.context?.event &&
    a.data === b.data &&
    (a.expiresAt ?? Infinity) <= (b.expiresAt ?? Infinity)
  );
}
export function createExtensionDecrypts(orchestrator: SignerOrchestrator) {
  const flights = new Set<Flight>(); // at most 16 private requests; released with their consumers
  return (
    message: Crypt,
    weight: SignerWeight,
    epoch: number,
    check: () => void,
    signal: AbortSignal,
  ): Promise<string> => {
    if (signal.aborted) return Promise.reject(new Error('cancelled'));
    let flight: Flight | undefined;
    if (message.operation.endsWith('.decrypt')) {
      for (const pending of flights) {
        if (
          pending.epoch === epoch &&
          pending.weight === weight &&
          same(pending.message, message)
        ) {
          flight = pending;
          break;
        }
      }
    }
    if (!flight) {
      const abort = new AbortController();
      const result = orchestrator.run(
        weight,
        (call) => {
          const guarded: ExtensionCall = (method) => call(method, check);
          return cryptWithExtension(message, guarded);
        },
        abort.signal,
        message.expiresAt,
      );
      flights.add((flight = { message, epoch, weight, abort, result, consumers: 0 }));
    }
    const shared = flight;
    shared.consumers++;
    return new Promise((resolve, reject) => {
      let waiting = true;
      const release = (): boolean => {
        if (!waiting) return false;
        waiting = false;
        signal.removeEventListener('abort', cancel);
        if (--shared.consumers === 0) {
          flights.delete(shared);
          shared.abort.abort();
        }
        return true;
      };
      const cancel = (): void => {
        if (release()) reject(new Error('cancelled'));
      };
      signal.addEventListener('abort', cancel, { once: true });
      void shared.result.then(
        (value) => {
          if (release()) resolve(value);
        },
        (error) => {
          if (release()) reject(error);
        },
      );
    });
  };
}
