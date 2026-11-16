// Registration belongs to one mounted store, including a refused store retained by its private tab.
import type { Failure } from '../engine/protocol.ts';
import type { ViewEnv } from './registry.ts';
export function createDmDraftLease(o: {
  env: ViewEnv;
  account: string;
  flush(): Promise<boolean>;
  changed(): void;
  failed(error: Failure): void;
  dirty(): boolean;
}) {
  const editor = crypto.randomUUID();
  let registered = false,
    held = false,
    closed = false,
    active = false,
    serial = 0;
  let pending: Promise<boolean> | undefined;
  let version = o.env.engine.info.get()?.version ?? 0;
  const changed = (): void => {
    if (active && !closed) o.changed();
  };
  const announce = async (force = false, dirty = o.dirty(), update = false): Promise<boolean> => {
    active = true;
    if (closed) return false;
    if (version < 8) {
      registered = true;
      return true;
    }
    if (!force && pending) return pending;
    if (!force && registered) return true;
    const lease = ++serial;
    if (!update) registered = false;
    changed();
    const request = o.env.engine.act({ a: 'dm.editor', as: o.account, editor, open: true, dirty });
    pending = request
      .catch(() => ({ ok: false, error: { code: 'internal' as const } }))
      .then((result) => {
        if (closed || lease !== serial) return false;
        pending = undefined;
        registered = result.ok;
        if (!result.ok) o.failed(result.error ?? { code: 'internal' });
        changed();
        return result.ok;
      });
    return pending;
  };
  const off = o.env.engine.dm?.flushers.add(o.account, o.flush, {
    hold(value) {
      held = value;
      changed();
    },
    suspend() {
      serial++;
      registered = false;
      pending = undefined;
    },
    register(next) {
      version = next;
      return announce(true);
    },
  });
  return {
    open: () => {
      if (off) return announce();
      o.failed({ code: 'too-large' });
      return Promise.resolve(false);
    },
    async settled(): Promise<boolean> {
      while (pending && !closed) await pending;
      return registered && !closed;
    },
    ready: () => registered && !held && !closed,
    held: () => held,
    registering: () => !!pending,
    registered: () => registered,
    dirty(value: boolean): void {
      if (!closed && version >= 8) void announce(true, value, true);
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      serial++;
      registered = false;
      off?.();
      if (version >= 8)
        await o.env.engine.act({ a: 'dm.editor', as: o.account, editor, open: false });
    },
  };
}
