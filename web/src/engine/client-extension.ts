import {
  extensionAvailable,
  extensionPublicKey,
  extensionSign,
  findExtension,
} from './client-crypto.ts';
import { createSignerWait, type SignerWait } from './extension-wait.ts';
import type { EngineStats, FromEngine, ToEngine } from './protocol.ts';
import { createSignerOrchestrator, type ExtensionCall } from './signer-orchestrator.ts';

export type SignerContext = {
  pressedAt: number;
  cancelled: boolean;
  wait?(stage: SignerWait): void;
};

export function createExtensionClient(post: (message: ToEngine) => void) {
  const orchestrator = createSignerOrchestrator();
  // Bound: 128 outstanding requests, including requests waiting for injection.
  const requests = new Map<
    string,
    { action: string; stop(reason?: string, reply?: boolean): void }
  >();
  const cancel = (action: string, reason?: string, reply = false): void => {
    for (const request of requests.values())
      if (request.action === action) request.stop(reason, reply);
  };
  const reset = (): void => {
    for (const request of requests.values()) request.stop();
    orchestrator.reset();
  };
  let sampled: EngineStats['extensionSigner'];
  let sampledAt = -Infinity;
  return {
    orchestrator,
    stats() {
      const now = performance.now();
      if (now - sampledAt >= 1000) {
        sampled = { ...orchestrator.stats(), available: extensionAvailable() };
        sampledAt = now;
      }
      return sampled;
    },
    cancel,
    reset,
    receive(
      message: FromEngine,
      wantsSign: (req: string) => boolean,
      context: (req: string) => SignerContext | undefined = () => undefined,
    ): boolean {
      if (message.t === 'reconnect') reset();
      if (message.t === 'sign.cancel') {
        requests.get(message.req)?.stop();
        return true;
      }
      if (message.t === 'result') cancel(message.req, message.error?.code);
      if (message.t !== 'sign' && message.t !== 'getPublicKey') return false;
      const { req } = message;
      if (requests.has(req)) return true;
      const action = message.t === 'sign' ? (message.actionReq ?? req) : req;
      const owned = wantsSign(action);
      const t = message.t === 'sign' ? 'signed' : 'publicKey';
      const owner = context(action);
      if (owner?.cancelled) {
        post({ t, req, error: 'cancelled' });
        return true;
      }
      if (
        (!owned && (message.t === 'getPublicKey' || message.actionReq !== undefined)) ||
        requests.size >= 128
      ) {
        post({ t, req, error: 'signer-refused' });
        return true;
      }
      const abort = new AbortController();
      const wait = owner?.wait ? createSignerWait(owner.wait) : () => {};
      let answered = false;
      const answer = (message: ToEngine): void => {
        if (answered) return;
        answered = true;
        wait(undefined);
        post(message);
      };
      const request = {
        action,
        stop(reason?: string, reply?: boolean) {
          if (requests.get(req) === request) requests.delete(req);
          if (answered || abort.signal.aborted) return;
          abort.abort(reason);
          wait(undefined);
          if (reply) answer({ t, req, error: 'cancelled' });
        },
      };
      requests.set(req, request);
      const pressedAt = owner?.pressedAt ?? performance.now();
      const task = findExtension({
        signal: abort.signal,
        pressedAt,
        expiresAt: message.expiresAt,
        finding: (on) => wait(on ? 'finding' : undefined, pressedAt),
      }).then((ext) =>
        orchestrator.run(
          message.t === 'sign' ? (message.weight ?? (owned ? 8 : 2)) : 8,
          (call) => {
            const observed: ExtensionCall = (method, before) =>
              call(async () => {
                wait('approval');
                try {
                  return await method();
                } finally {
                  if (!abort.signal.aborted) wait(undefined);
                }
              }, before);
            return message.t === 'sign'
              ? extensionSign(message, observed, ext)
              : extensionPublicKey(observed, ext);
          },
          abort.signal,
          message.expiresAt,
        ),
      );
      void task
        .then(
          (value) => {
            if (!abort.signal.aborted)
              answer(t === 'signed' ? { t, req, event: value } : { t, req, pubkey: value });
          },
          (error: Error) => {
            if (abort.signal.aborted || error.message === 'cancelled') return;
            // The Worker reports its own deadline with the error specific to this operation.
            if (error.message === 'signer-timeout' && message.expiresAt !== undefined) return;
            const code =
              error.message === 'signer-missing' || error.message === 'signer-timeout'
                ? 'signer-missing'
                : 'signer-refused';
            answer({ t, req, error: code });
          },
        )
        .finally(() => {
          wait(undefined);
          if (requests.get(req) === request) requests.delete(req);
        });
      return true;
    },
  };
}
