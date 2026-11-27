import { extensionAvailable, extensionPublicKey, extensionSign } from './client-crypto.ts';
import type { EngineStats, FromEngine, ToEngine } from './protocol.ts';
import { createSignerOrchestrator } from './signer-orchestrator.ts';

export function createExtensionClient(post: (message: ToEngine) => void) {
  const orchestrator = createSignerOrchestrator();
  // Owned by the queue (at most 128) and cancelled when the action or connection ends.
  const requests = new Map<string, { action: string; abort: AbortController }>();
  const cancel = (action: string, reason?: string): void => {
    for (const request of requests.values())
      if (request.action === action) request.abort.abort(reason);
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
    receive(message: FromEngine, wantsSign: (req: string) => boolean): boolean {
      if (message.t === 'reconnect') {
        for (const request of requests.values()) request.abort.abort();
        orchestrator.reset();
      }
      if (message.t === 'sign.cancel') {
        requests.get(message.req)?.abort.abort();
        return true;
      }
      if (message.t === 'result') cancel(message.req, message.error?.code);
      if (message.t !== 'sign' && message.t !== 'getPublicKey') return false;
      const { req } = message;
      if (requests.has(req)) return true;
      const action = message.t === 'sign' ? (message.actionReq ?? req) : req;
      const owned = wantsSign(action);
      const t = message.t === 'sign' ? 'signed' : 'publicKey';
      if (message.t === 'sign' && message.actionReq && !owned) {
        post({ t, req, error: 'signer-refused' });
        return true;
      }
      const abort = new AbortController();
      requests.set(req, { action, abort });
      const task =
        message.t === 'sign'
          ? orchestrator.run(
              message.weight ?? (owned ? 8 : 2),
              (call) => extensionSign(message, call),
              abort.signal,
              message.expiresAt,
            )
          : orchestrator.run(8, extensionPublicKey, abort.signal, message.expiresAt);
      void task
        .then(
          (value) => {
            if (!abort.signal.aborted)
              post(t === 'signed' ? { t, req, event: value } : { t, req, pubkey: value });
          },
          (error: Error) => {
            if (abort.signal.aborted || error.message === 'cancelled') return;
            // The Worker reports its own deadline with the error specific to this operation.
            if (error.message === 'signer-timeout' && message.expiresAt !== undefined) return;
            const code =
              error.message === 'signer-missing' || error.message === 'signer-timeout'
                ? 'signer-missing'
                : 'signer-refused';
            post({ t, req, error: code });
          },
        )
        .finally(() => requests.delete(req));
      return true;
    },
  };
}
