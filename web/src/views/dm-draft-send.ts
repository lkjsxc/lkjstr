// Send work belongs to the retained store, so a refused view cannot lose its eventual delivery state.
import type { DmFailedDraft } from '../engine/protocol.ts';
import type { createDmDraftStore } from './dm-draft-store.ts';
import type { ViewEnv } from './registry.ts';
export function transmitDm(o: {
  env: ViewEnv;
  account: string;
  store: ReturnType<typeof createDmDraftStore>;
  key: string;
}) {
  const { store, key } = o;
  const patch = (update: (row: DmFailedDraft) => DmFailedDraft): void => {
    store.replace({
      ...store.get(),
      failed: store.get().failed.map((row) => (row.key === key ? update(row) : row)),
    });
  };
  store.run(key, async () => {
    patch((row) => ({ key, draft: row.draft }));
    if (!(await store.flush()) || !store.ready()) return;
    const request = (() => {
      const row = store.get().failed.find((row) => row.key === key);
      return row ? o.env.engine.act({ a: 'dm.send', as: o.account, draft: row.draft }) : undefined;
    })();
    if (!request) return;
    const result = await request;
    if (!store.alive()) return;
    patch((row) => ({
      key,
      draft: row.draft,
      ...(result.id ? { id: result.id } : {}),
      ...(result.dmDelivery ? { dmDelivery: result.dmDelivery } : {}),
      ...(!result.ok ? { error: result.error ?? { code: 'internal' as const } } : {}),
    }));
    await store.flush();
  });
}
