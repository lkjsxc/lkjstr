// A finite observation request; hiding/disposal revokes its exact owner lease.
import type { Transport } from './client-transport.ts';
import type { Failure, FromEngine, StorageReport } from './protocol.ts';
export type StorageInspectionResult =
  | { readonly ok: true; readonly report: StorageReport }
  | { readonly ok: false; readonly error: Failure }
  | { readonly ok: false; readonly cancelled: true };
export function createStorageClient(transport: Transport) {
  const prefix = `storage-${crypto.randomUUID()}-`;
  let serial = 0;
  let version = 0;
  let closed = false;
  let visible = true;
  let pending:
    | { req: string; finish(result: StorageInspectionResult, close?: boolean): void }
    | undefined;
  const fail = (code: Failure['code']): StorageInspectionResult => ({ ok: false, error: { code } });
  const cancel = (): void => pending?.finish({ ok: false, cancelled: true }, true);
  return {
    inspect(options: { readonly signal?: AbortSignal } = {}): Promise<StorageInspectionResult> {
      if (closed || !visible || options.signal?.aborted)
        return Promise.resolve({ ok: false, cancelled: true });
      if (version < 12) return Promise.resolve(fail(version ? 'unsupported' : 'offline'));
      if (pending) return Promise.resolve(fail('too-large'));
      const req = prefix + String(++serial);
      return new Promise((resolve) => {
        const aborted = (): void => {
          if (pending?.req === req) cancel();
        };
        const finish = (result: StorageInspectionResult, close = false): void => {
          if (pending?.req !== req) return;
          pending = undefined;
          clearTimeout(timer);
          options.signal?.removeEventListener('abort', aborted);
          if (close) transport.post({ t: 'storage.close', req });
          resolve(result);
        };
        // Worker policy expires at 15 s; the extra second only bounds delivery failure.
        const timer = setTimeout(() => finish(fail('offline'), true), 16_000);
        pending = { req, finish };
        options.signal?.addEventListener('abort', aborted, { once: true });
        transport.post({ t: 'storage.inspect', req });
      });
    },
    receive(message: FromEngine): boolean {
      if (message.t === 'ready') version = message.version;
      if (message.t === 'reconnect') {
        version = 0;
        pending?.finish(fail('offline'), true);
      }
      if (message.t === 'storage') {
        if (pending?.req === message.req) pending.finish({ ok: true, report: message.report });
        return true;
      }
      if (message.t === 'result' && pending?.req === message.req) {
        pending.finish({ ok: false, error: message.error ?? { code: 'internal' } });
        return true;
      }
      return false;
    },
    visible(on: boolean) {
      visible = on;
      if (!on) cancel();
    },
    dispose() {
      closed = true;
      cancel();
    },
  };
}
