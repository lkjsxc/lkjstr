// A cancelled result confirms removal by the owning queue or Worker.

import { createSignal } from '../shared/signal.ts';
import type { ActResult, ActWatch, Transport } from './client.ts';
import type { Action, FromEngine } from './protocol.ts';

type Pending = {
  done(result: ActResult): void;
  watch?: ActWatch;
  upload: boolean;
  zap: boolean;
  cancelled: boolean;
  note: boolean;
};
export function createActionRequests(
  transport: Transport,
  next: () => string,
  addDelivery: (req: string, watch?: ActWatch) => void,
) {
  const pending = new Map<string, Pending>(); // <=64 requests allowed by transport
  const posting = createSignal(false);
  const finish = (result: ActResult): void => {
    const entry = pending.get(result.req);
    if (!entry) return;
    pending.delete(result.req);
    if (entry.note) posting.set([...pending.values()].some((action) => action.note));
    entry.done(result);
  };
  return {
    posting,
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
    signed(msg: Extract<FromEngine, { t: 'publish.signed' }>): void {
      pending.get(msg.req)?.watch?.signed?.(msg.id);
    },
    fallback(req: string): void {
      pending.get(req)?.watch?.fallback?.();
    },
    result: finish,
    act(action: Action, watch?: ActWatch): Promise<ActResult> {
      const req = next();
      const upload = action.a === 'upload';
      const zap = action.a === 'zap.invoice';
      const note = action.a === 'publish' && action.what.k === 'note';
      const signal = upload ? watch?.uploadSignal : zap ? watch?.zapSignal : undefined;
      if (signal?.aborted) return Promise.resolve({ t: 'result', req, ok: false, cancelled: true });
      if (pending.size >= 64)
        return Promise.resolve({ t: 'result', req, ok: false, error: { code: 'internal' } });
      addDelivery(req, watch);
      return new Promise((done) => {
        const cancel = (): void => {
          const entry = pending.get(req);
          if (!entry || entry.cancelled) return;
          entry.cancelled = true;
          if (upload) transport.post({ t: 'upload.cancel', req });
          else if (zap) transport.post({ t: 'zap.close', req });
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
            : zap
              ? setTimeout(() => {
                  if (!pending.has(req)) return;
                  finish({ t: 'result', req, ok: false, error: { code: 'offline' } });
                  transport.post({ t: 'zap.close', req });
                }, 95_000)
              : undefined;
        pending.set(req, {
          upload,
          zap,
          note,
          watch,
          cancelled: false,
          done(result) {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
            done(result);
          },
        });
        if (note) posting.set(true);
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
        if (entry.zap) transport.post({ t: 'zap.close', req });
      }
    },
  };
}
