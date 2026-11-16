// Private subscriptions stay separate from public row/profile caches.
import type { Transport } from './client.ts';
import { createDmAccess } from './client-dm-access.ts';
import { createDmFlushers } from './client-dm-flush.ts';
import type { DmQuery, DmSnapshot, FromEngine } from './protocol.ts';
export function createDmClient(transport: Transport) {
  let serial = 0;
  const flushers = createDmFlushers((message) => transport.post(message));
  const access = createDmAccess((message) => transport.post(message));
  const visibility = new Map<string, { account: string; visible: boolean }>();
  const pause = (account: string): void => {
    if (![...visibility.values()].some((value) => value.account === account && value.visible))
      access.pause(account);
  };
  const listeners = new Map<string, (snapshot: DmSnapshot) => void>(); // <=32 private subscriptions
  return {
    access,
    flushers,
    open(
      query: DmQuery,
      receive: (snapshot: DmSnapshot) => void,
      options: { readonly visible?: boolean } = {},
    ) {
      const sub = 'dm' + String(++serial);
      if (listeners.size >= 32) {
        let closed = false;
        queueMicrotask(() => {
          if (!closed)
            receive({
              account: query.account,
              conversations: [],
              messages: [],
              more: false,
              undecryptable: 0,
              phase: 'failed',
              error: 'too-large',
            });
        });
        return {
          id: sub,
          visible() {},
          more() {},
          close() {
            closed = true;
          },
        };
      }
      visibility.set(sub, { account: query.account, visible: options.visible !== false });
      listeners.set(sub, receive);
      transport.post({
        t: 'dm.open',
        sub,
        query,
        ...(options.visible === undefined ? {} : { visible: options.visible }),
      });
      return {
        id: sub,
        visible: (visible: boolean) => {
          const previous = visibility.get(sub);
          if (!previous) return;
          visibility.set(sub, { ...previous, visible });
          transport.post({ t: 'dm.visible', sub, visible });
          if (!visible && previous.visible) pause(query.account);
        },
        more: () => transport.post({ t: 'dm.more', sub }),
        close: () => {
          const previous = visibility.get(sub);
          visibility.delete(sub);
          if (listeners.delete(sub)) transport.post({ t: 'dm.close', sub });
          if (previous?.visible) pause(query.account);
        },
      };
    },
    receive: (message: Extract<FromEngine, { t: 'dm' }>) => {
      const receive = listeners.get(message.sub);
      if (!receive) return;
      if (message.snapshot.error) access.block(message.snapshot.account, message.snapshot.error);
      if (listeners.get(message.sub) === receive) receive(message.snapshot);
    },
    dispose: () => {
      access.dispose();
      flushers.dispose();
      for (const sub of listeners.keys()) transport.post({ t: 'dm.close', sub });
      listeners.clear();
      visibility.clear();
    },
  };
}
