// The mock has row fixtures, no signed-event store or browser storage effects.
import type { FromEngine, ToEngine } from '../protocol.ts';
export function createStorageMock(post: (message: FromEngine) => void, now = () => performance.now()) {
  let pending: { req: string; at: number } | undefined;
  let hidden = false;
  let stopped = false;
  return {
    handle(message: ToEngine): boolean {
      if (message.t === 'hint') { hidden = message.hint.pageHidden; if (hidden) pending = undefined; }
      if (message.t === 'detach') { stopped = true; pending = undefined; }
      if (message.t === 'storage.close') {
        if (pending?.req === message.req) pending = undefined;
        return true;
      }
      if (message.t !== 'storage.inspect') return false;
      if (stopped) return true;
      if (hidden || !message.req || new TextEncoder().encode(message.req).length > 256 || pending) {
        if (pending?.req !== message.req) post({ t: 'result', req: message.req, ok: false, error: { code: pending ? 'too-large' : 'rejected' } });
        return true;
      }
      const job = { req: message.req, at: Math.floor(now()) };
      pending = job;
      queueMicrotask(() => {
        if (pending !== job || stopped || hidden) return;
        pending = undefined;
        post({ t: 'storage', req: job.req, report: {
          startedAt: job.at, finishedAt: Math.floor(now()),
          memory: { events: 0, eventPayloadBytes: 0, at: job.at },
          persistedEvents: { phase: 'unsupported' }, origin: { phase: 'unsupported' },
        } });
      });
      return true;
    },
    dispose() { stopped = true; pending = undefined; },
  };
}
