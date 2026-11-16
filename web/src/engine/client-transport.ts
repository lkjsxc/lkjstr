// Dedicated Worker facade; shared/fallback transport remains in engine/transport.js.
import type { FromEngine, ToEngine } from './protocol.ts';
export type Transport = {
  post(msg: ToEngine, transfer?: Transferable[]): void;
  listen(fn: (msg: FromEngine) => void): void;
  close(): void;
};
export function workerTransport(url: string): Transport {
  const worker = new Worker(url, { type: 'module', name: 'lkjstr-engine' });
  return {
    post: (msg, transfer) => worker.postMessage(msg, transfer ?? []),
    listen: (fn) => void (worker.onmessage = (e: MessageEvent<FromEngine>) => fn(e.data)),
    close: () => worker.terminate(),
  };
}
