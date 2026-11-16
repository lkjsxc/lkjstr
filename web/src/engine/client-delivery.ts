// Delivery listeners live with displayed results, independently of action promises.

import type { ActWatch } from './client.ts';
import type { Delivery, FromEngine } from './protocol.ts';
export function createDeliveryWatches(changed: () => void) {
  const watches = new Map<
    string,
    { receive(relays: readonly Delivery[]): void; release(): void }
  >();
  const remove = (req: string): void => {
    const watch = watches.get(req);
    if (!watch) return;
    watches.delete(req);
    watch.release();
    changed();
  };
  return {
    ids: () => [...watches.keys()],
    add(req: string, watch?: ActWatch): void {
      if (!watch?.delivery || watch.deliverySignal?.aborted) return;
      // A page has at most 128 mounted views; each composer retains one result.
      if (watches.size >= 128) remove(watches.keys().next().value!);
      const abort = (): void => remove(req);
      watch.deliverySignal?.addEventListener('abort', abort, { once: true });
      watches.set(req, {
        receive: watch.delivery,
        release: () => watch.deliverySignal?.removeEventListener('abort', abort),
      });
      changed();
    },
    receive(msg: Extract<FromEngine, { t: 'delivery' }>): void {
      watches.get(msg.req)?.receive(msg.relays);
    },
    result(msg: Extract<FromEngine, { t: 'result' }>): void {
      if (!msg.delivery?.length) remove(msg.req);
    },
    dispose(): void {
      for (const watch of watches.values()) watch.release();
      watches.clear();
    },
  };
}
