// Opted-in list reads share the crypto executor, never the Messages consent preference.
import type { createDmAccess } from './client-dm-access.ts';
import type { FromEngine, Query, ToEngine } from './protocol.ts';

type Crypt = Extract<FromEngine, { t: 'crypt' }>;
const visiblePage = (): boolean => document.visibilityState !== 'hidden';
export function createPrivateListClient(
  access: ReturnType<typeof createDmAccess>,
  post: (message: ToEngine) => void,
) {
  const views = new Map<string, { query: Query; visible: boolean }>(); // <=128 mounted subscriptions
  const pending = new Map<string, { sub: string; stop: () => void }>(); // <=16 list requests
  const cancelRequest = (req: string): void => {
    const request = pending.get(req);
    if (!request) return;
    pending.delete(req);
    request.stop();
    access.cancel(req);
  };
  const cancel = (sub?: string): void => {
    for (const [req, request] of pending)
      if (sub === undefined || request.sub === sub) cancelRequest(req);
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
    cancel: cancelRequest,
    async crypt(message: Crypt): Promise<void> {
      if (pending.has(message.req)) return;
      const context = message.context;
      const view = context ? views.get(context.sub) : undefined;
      // A hidden/closed view is a cancellation, never a signer refusal.
      if (!view?.visible || !visiblePage()) return;
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
      // An extension can run script or open a prompt as soon as it is called.
      // Leave one paint opportunity for public rows already delivered by the Worker.
      const request = { sub: context.sub, stop: () => {} };
      pending.set(message.req, request);
      try {
        await new Promise<void>((resolve) => {
          let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => resolve());
          });
          request.stop = () => {
            cancelAnimationFrame(frame);
            resolve();
          };
        });
        if (pending.get(message.req) === request && visiblePage()) await access.crypt(message);
      } finally {
        if (pending.get(message.req) === request) pending.delete(message.req);
      }
    },
    dispose(): void {
      cancel();
      views.clear();
    },
  };
}
