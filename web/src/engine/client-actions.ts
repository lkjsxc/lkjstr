// A cancelled result confirms removal by the owning queue or Worker.
import type { ActResult, ActWatch, Transport } from './client.ts';
import type { Action, FromEngine } from './protocol.ts';

type Pending = {
  done(result: ActResult): void;
  watch?: ActWatch;
  upload: boolean;
  cancelled: boolean;
};
export function createActionRequests(
  transport: Transport,
  next: () => string,
  addDelivery: (req: string, watch?: ActWatch) => void,
) {
  const pending = new Map<string, Pending>(); // <=64 requests allowed by transport
  const finish = (result: ActResult): void => {
    const entry = pending.get(result.req);
    if (!entry) return;
    pending.delete(result.req);
    entry.done(result);
  };
  return {
    wantsSign(actionReq?: string): boolean {
      return (
        actionReq === undefined ||
        Boolean(pending.get(actionReq) && !pending.get(actionReq)?.cancelled)
      );
    },
    progress(msg: Extract<FromEngine, { t: 'progress' }>): void {
      const entry = pending.get(msg.req);
      if (entry && !entry.cancelled) entry.watch?.progress?.(msg.sent, msg.total, msg);
    },
    result: finish,
    act(action: Action, watch?: ActWatch): Promise<ActResult> {
      const req = next();
      const upload = action.a === 'upload';
      const signal = upload ? watch?.uploadSignal : undefined;
      if (signal?.aborted) return Promise.resolve({ t: 'result', req, ok: false, cancelled: true });
      if (pending.size >= 64)
        return Promise.resolve({ t: 'result', req, ok: false, error: { code: 'internal' } });
      addDelivery(req, watch);
      return new Promise((done) => {
        const cancel = (): void => {
          const entry = pending.get(req);
          if (!entry || entry.cancelled) return;
          entry.cancelled = true;
          transport.post({ t: 'upload.cancel', req });
        };
        const timer = upload
          ? setTimeout(() => {
              if (!pending.has(req)) return;
              finish({
                t: 'result',
                req,
                ok: false,
                error: {
                  code: 'upload-timeout',
                  message: action.a === 'upload' ? action.server : undefined,
                },
              });
              transport.post({ t: 'upload.cancel', req });
            }, 300_000)
          : action.a === 'dm.editor'
            ? setTimeout(
                () => finish({ t: 'result', req, ok: false, error: { code: 'internal' } }),
                15_000,
              )
            : undefined;
        pending.set(req, {
          upload,
          watch,
          cancelled: false,
          done(result) {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            done(result);
          },
        });
        signal?.addEventListener('abort', cancel, { once: true });
        transport.post(
          { t: 'act', req, action },
          action.a === 'upload' ? [action.bytes] : undefined,
        );
      });
    },
    dispose(): void {
      for (const [req, entry] of pending) {
        finish({ t: 'result', req, ok: false, error: { code: 'offline' } });
        if (entry.upload) transport.post({ t: 'upload.cancel', req });
      }
    },
  };
}
