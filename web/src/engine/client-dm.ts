// Private subscriptions stay separate from public row/profile caches.
import type { Transport } from './client.ts';
import type { DmQuery, DmSnapshot, FromEngine } from './protocol.ts';
export function createDmClient(transport: Transport) {
  let serial = 0;
  const listeners = new Map<string, (snapshot: DmSnapshot) => void>(); // <=32 private subscriptions
  return {
    open(query: DmQuery, receive: (snapshot: DmSnapshot) => void) {
      if (listeners.size >= 32) throw new Error('private subscription limit');
      const sub = 'dm' + String(++serial);
      listeners.set(sub, receive);
      transport.post({ t: 'dm.open', sub, query });
      return {
        id: sub,
        visible: (visible: boolean) => transport.post({ t: 'dm.visible', sub, visible }),
        more: () => transport.post({ t: 'dm.more', sub }),
        close: () => {
          if (listeners.delete(sub)) transport.post({ t: 'dm.close', sub });
        },
      };
    },
    receive: (message: Extract<FromEngine, { t: 'dm' }>) =>
      listeners.get(message.sub)?.(message.snapshot),
    dispose: () => {
      for (const sub of listeners.keys()) transport.post({ t: 'dm.close', sub });
      listeners.clear();
    },
  };
}
