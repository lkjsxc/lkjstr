// One private tab/account owns its editor, sends and serialized encrypted archive writer.
import type { DmDraft, DmDraftState, Failure } from '../engine/protocol.ts';
import { createDmDraftArchive } from './dm-draft-archive.ts';
import { createDmDraftLease } from './dm-draft-lease.ts';
import type { ViewEnv } from './registry.ts';

type Listener = { changed(): void; failed(error: Failure): void };
export function createDmDraftStore(
  o: Listener & { env: ViewEnv; account: string; recipients: readonly string[] },
) {
  let state: DmDraftState = { draft: { recipients: o.recipients, text: '' }, failed: [] };
  let stopped = false,
    closing = false,
    loaded = false,
    loading = false,
    writable = false;
  let revision = 0,
    saved = 0,
    declaredDirty = false;
  let lastError: Failure | undefined;
  let listener: Listener | undefined = o;
  let timer: ReturnType<typeof setTimeout> | undefined, writing: Promise<boolean> | undefined;
  const work = new Map<string, Promise<void>>(); // <=32 retained outbox rows
  const changed = (): void => {
    if (!stopped) listener?.changed();
  };
  const failed = (error: Failure): void => {
    lastError = error;
    if (!stopped) listener?.failed(error);
  };
  const archive = createDmDraftArchive({
    engine: o.env.engine,
    account: o.account,
    tab: o.env.instance,
    failed,
  });
  const enabled = (): boolean => (o.env.engine.info.get()?.version ?? 0) >= 8;
  const authority = (): boolean => {
    const a = o.env.engine.accounts.get().accounts.find((a) => a.author.pubkey === o.account);
    return !!a && a.signer !== 'none' && !a.locked;
  };
  const allowed = (): boolean => {
    const a = o.env.engine.accounts.get().accounts.find((a) => a.author.pubkey === o.account);
    return authority() && o.env.engine.dm?.access.status(a) === 'ready';
  };
  const dirty = (): boolean => revision !== saved || work.size > 0;
  const declare = (): void => {
    const value = dirty();
    if (value !== declaredDirty) {
      declaredDirty = value;
      lease.dirty(value);
    }
  };
  const flush = async (): Promise<boolean> => {
    clearTimeout(timer);
    timer = undefined;
    if (writing) {
      const ok = await writing;
      return ok && revision !== saved ? flush() : ok;
    }
    if (stopped || !allowed()) return false;
    if (!enabled() || revision === saved) return true;
    if (!loaded || !writable) return false;
    if (!lease.registered() && !(await lease.open())) return false;
    const at = revision;
    writing = archive
      .save(state)
      .then((ok) => {
        if (ok && !stopped) {
          saved = at;
          declare();
        }
        return ok;
      })
      .finally(() => {
        writing = undefined;
      });
    const ok = await writing;
    return ok && revision !== saved && !stopped ? flush() : ok;
  };
  const barrier = async (): Promise<boolean> => {
    while (work.size && !stopped) await Promise.all([...work.values()]);
    return (await flush()) && (await lease.settled());
  };
  const lease = createDmDraftLease({
    env: o.env,
    account: o.account,
    flush: barrier,
    changed,
    failed,
    dirty,
  });
  const replace = (next: DmDraftState): void => {
    if (stopped || !writable) return;
    state = next;
    revision++;
    lastError = undefined;
    declare();
    changed();
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 180);
  };
  const samePeople = (draft: DmDraft): boolean => {
    const wanted = [...new Set([o.account, ...o.recipients])].sort();
    const got = [...new Set([o.account, ...draft.recipients])].sort();
    return wanted.length === got.length && wanted.every((key, i) => key === got[i]);
  };
  const load = async (): Promise<void> => {
    if (stopped || closing || loading) return;
    loading = true;
    changed();
    const registered = await lease.open();
    if (stopped || closing) return;
    if (!registered) {
      loaded = true;
      loading = false;
      changed();
      return;
    }
    if (writable || !enabled()) {
      loaded = writable = true;
      loading = false;
      changed();
      if (dirty()) void flush();
      return;
    }
    const result = await archive.load();
    if (stopped || closing) return;
    loading = false;
    if (!allowed()) return;
    loaded = true;
    const restored = result.dmDraft;
    const compatible =
      !restored ||
      (samePeople(restored.draft) && restored.failed.every((row) => samePeople(row.draft)));
    if (result.ok && compatible && result.dmDraftRevision !== undefined) {
      archive.accept(restored, result.dmDraftRevision);
      if (restored && revision === 0) state = restored;
      writable = true;
    } else failed(result.ok ? { code: 'rejected' } : (result.error ?? { code: 'internal' }));
    changed();
  };
  const ready = (): boolean =>
    !stopped && !closing && loaded && writable && allowed() && lease.ready();
  queueMicrotask(() => void load());
  const clear = (): void => {
    stopped = true;
    archive.dispose();
    state = { draft: { recipients: [], text: '' }, failed: [] };
    lastError = undefined;
    listener = undefined;
    void lease.close();
  };
  return {
    get: () => state,
    alive: () => !stopped && authority(),
    ready,
    held: lease.held,
    loading: () => !loaded || loading || (!lease.registered() && lease.registering()),
    retryable: () =>
      loaded &&
      (!writable || !lease.registered() || archive.uncertain()) &&
      !loading &&
      !lease.registering(),
    retry: () => void load(),
    replace,
    flush,
    draft: (draft: DmDraft) => {
      if (ready()) replace({ ...state, draft });
    },
    busy: (key: string) => work.has(key),
    run(key: string, task: () => Promise<void>): void {
      if (!ready() || work.has(key)) return;
      const promise = Promise.resolve()
        .then(task)
        .catch(() => failed({ code: 'internal' }))
        .finally(() => {
          work.delete(key);
          declare();
          changed();
        });
      work.set(key, promise);
      declare();
      changed();
    },
    attach(next: Listener): () => void {
      listener = next;
      queueMicrotask(() => {
        if (stopped || listener !== next) return;
        if (lastError) next.failed(lastError);
        next.changed();
        void load();
      });
      return () => {
        if (listener === next) listener = undefined;
      };
    },
    dispose(discard = false): void {
      if (stopped || closing) return;
      clearTimeout(timer);
      closing = true;
      if (!discard && allowed()) void barrier().finally(clear);
      else clear();
    },
  };
}
