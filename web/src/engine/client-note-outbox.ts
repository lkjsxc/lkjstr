// The Worker owns signed events. The page watches only the statuses its composers retain.
import type { Transport } from './client-transport.ts';
import type { FromEngine, NoteOutboxStatus } from './protocol.ts';

export function createNoteOutbox(transport: Transport) {
  type Watch = (status: NoteOutboxStatus | undefined) => void;
  const watches = new Map<string, Watch>(); // Bounded by retained composer drafts, batched by 128.
  let timer: ReturnType<typeof setInterval> | undefined;
  let connected = false;
  let queued = false;

  const poll = (): void => {
    if (!connected || !watches.size || queued || document.visibilityState === 'hidden') return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!connected) return;
      const keys = [...watches.keys()];
      for (let i = 0; i < keys.length; i += 128)
        transport.post({ t: 'note.outbox', keys: keys.slice(i, i + 128) });
    });
  };
  const wake = (): void => {
    if (!connected) return;
    transport.post({ t: 'note.wake' });
    poll();
  };
  const visible = (): void => {
    if (document.visibilityState !== 'hidden') wake();
  };
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', wake);
  window.addEventListener('pageshow', wake);
  return {
    watch(key: string, update: Watch): () => void {
      watches.set(key, update);
      timer ??= setInterval(poll, 1_000);
      poll();
      return () => {
        if (watches.get(key) !== update) return;
        watches.delete(key);
        if (!watches.size) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    receive(msg: FromEngine): boolean {
      if (msg.t === 'reconnect') connected = false;
      if (msg.t === 'ready' && !msg.accountError) {
        connected = true;
        poll();
      }
      if (msg.t !== 'note.outbox') return false;
      const entries = new Map(msg.statuses.map((entry) => [entry.key, entry]));
      for (const key of msg.keys) watches.get(key)?.(entries.get(key));
      return true;
    },
    discard(key: string): void {
      transport.post({ t: 'note.discard', key });
      poll();
    },
    dispose(): void {
      connected = false;
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      clearInterval(timer);
      watches.clear();
    },
  };
}
