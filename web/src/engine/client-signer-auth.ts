// Ephemeral authorization intent only. The client never opens or persists an auth URL.
import { createSignal } from '../shared/signal.ts';
import type { Transport } from './client-transport.ts';
import type { FromEngine, SignerAuthorization } from './protocol.ts';
export function createSignerAuthClient(transport: Transport) {
  const pending = createSignal<readonly SignerAuthorization[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>(); // at most 16 owned calls
  let disposed = false;
  let presenters = 0; // One lease per live subscriber to the authorization surface.
  const subscribe = pending.subscribe;
  pending.subscribe = (fn) => {
    if (disposed) return () => {};
    presenters++;
    const off = subscribe((value) => fn(value));
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      off();
      presenters--;
      if (!disposed && presenters === 0) {
        const ids = pending.get().map((row) => row.id);
        reset();
        for (const id of ids)
          transport.post({ t: 'signer.auth.cancel', id, reason: 'unsupported' });
      }
    };
  };
  function clear(id: string): void {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const rows = pending.get();
    if (rows.some((row) => row.id === id)) pending.set(rows.filter((row) => row.id !== id));
  }
  function reset(): void {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    pending.set([]);
  }
  function cancel(id: string): void {
    if (!disposed && timers.has(id)) transport.post({ t: 'signer.auth.cancel', id });
  }
  return {
    pending,
    cancel,
    receive(message: FromEngine): boolean {
      if (disposed) return message.t === 'signer.auth' || message.t === 'signer.auth.clear';
      if (message.t === 'reconnect' || message.t === 'ready') reset();
      if (message.t === 'accounts') {
        for (const row of pending.get()) {
          if (
            row.account &&
            !message.accounts.some((a) => a.author.pubkey === row.account && !a.locked)
          )
            clear(row.id);
        }
      }
      if (message.t === 'signer.auth.clear') {
        clear(message.id);
        return true;
      }
      if (message.t !== 'signer.auth') return false;
      if (presenters === 0) {
        transport.post({ t: 'signer.auth.cancel', id: message.id, reason: 'unsupported' });
        return true;
      }
      const previous = pending.get().find((row) => row.id === message.id);
      if (!previous && timers.size >= 16) {
        transport.post({ t: 'signer.auth.cancel', id: message.id });
        return true;
      }
      const expiresAt = Math.min(previous?.expiresAt ?? message.expiresAt, message.expiresAt);
      if (expiresAt <= Date.now()) {
        clear(message.id);
        return true;
      }
      if (previous?.url === message.url && previous.expiresAt === expiresAt) return true;
      clearTimeout(timers.get(message.id));
      timers.set(
        message.id,
        setTimeout(() => clear(message.id), Math.min(60_000, expiresAt - Date.now())),
      );
      const { t: _kind, ...intent } = message;
      pending.set([
        ...pending.get().filter((row) => row.id !== message.id),
        { ...intent, expiresAt },
      ]);
      return true;
    },
    dispose(): void {
      for (const row of pending.get()) cancel(row.id);
      disposed = true;
      reset();
    },
  };
}
