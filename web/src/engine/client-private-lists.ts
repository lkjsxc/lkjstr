// Opted-in list reads share the crypto executor, never the Messages consent preference.
import type { createDmAccess } from './client-dm-access.ts';
import type { FromEngine, Query, ToEngine } from './protocol.ts';

type Crypt = Extract<FromEngine, { t: 'crypt' }>;
export function createPrivateListClient(
  access: ReturnType<typeof createDmAccess>,
  post: (message: ToEngine) => void,
) {
  const views = new Map<string, { query: Query; visible: boolean }>(); // <=128 mounted subscriptions
  const pending = new Map<string, string>(); // <=16 shared crypto calls
  const cancel = (sub?: string): void => {
    for (const [req, owner] of pending)
      if (sub === undefined || owner === sub) {
        access.cancel(req);
        pending.delete(req);
      }
  };
  return {
    open(sub: string, query: Query): void {
      if (query.privateLists && views.size < 128) views.set(sub, { query, visible: false });
    },
    visible(sub: string, visible: boolean): void {
      const view = views.get(sub);
      if (!view) return;
      view.visible = visible;
      if (!visible) cancel(sub);
    },
    close(sub: string): void {
      cancel(sub);
      views.delete(sub);
    },
    hidden(): void {
      cancel();
    },
    cancel(req: string): void {
      if (pending.delete(req)) access.cancel(req);
    },
    async crypt(message: Crypt): Promise<void> {
      if (pending.has(message.req)) return;
      const context = message.context;
      const view = context ? views.get(context.sub) : undefined;
      // A hidden/closed view is a cancellation, never a signer refusal.
      if (!view?.visible || document.visibilityState === 'hidden') return;
      if (
        context?.kind !== 'private-list' ||
        view.query.account !== message.pubkey ||
        message.peer !== message.pubkey ||
        message.operation === 'nip44.encrypt' ||
        !/^[0-9a-f]{64}$/.test(context.event)
      ) {
        post({ t: 'crypted', req: message.req, error: 'rejected' });
        return;
      }
      if (pending.size >= 16) {
        post({ t: 'crypted', req: message.req, error: 'too-large' });
        return;
      }
      pending.set(message.req, context.sub);
      await access.crypt(message).finally(() => pending.delete(message.req));
    },
    dispose(): void {
      cancel();
      views.clear();
    },
  };
}
