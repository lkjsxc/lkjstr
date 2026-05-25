import {
  incMemoryCounter,
  decMemoryCounter,
  setMemoryCounter,
} from '../app/memory-counters';

export type ScheduledReq = {
  readonly id: string;
  readonly critical: boolean;
  readonly start: () => void;
  readonly drop: () => void;
};

export type RelayReqScheduler = ReturnType<typeof createRelayReqScheduler>;

export const maxPendingRelayReqs = 64;

export function createRelayReqScheduler() {
  const active = new Set<string>();
  let pending: ScheduledReq[] = [];

  const release = (maxActive: number): void => {
    while (active.size < maxActive && pending.length > 0) {
      const next = pending.shift();
      if (!next) return;
      active.add(next.id);
      decMemoryCounter('pending-relay-request-queue');
      next.start();
    }
  };

  return {
    activeIds: active,
    hasPending: (): boolean => pending.length > 0,
    schedule: (req: ScheduledReq, maxActive: number): boolean => {
      if (active.has(req.id)) active.delete(req.id);
      if (active.size < maxActive) {
        active.add(req.id);
        req.start();
        return true;
      }
      pending = pending.filter((item) => item.id !== req.id);
      if (pending.length >= maxPendingRelayReqs) {
        const dropIndex = pending.findIndex((item) => !item.critical);
        const [dropped] = pending.splice(dropIndex >= 0 ? dropIndex : 0, 1);
        dropped?.drop();
        decMemoryCounter('pending-relay-request-queue');
      }
      pending.push(req);
      incMemoryCounter('pending-relay-request-queue');
      return false;
    },
    release: (id: string, maxActive: number): void => {
      active.delete(id);
      release(maxActive);
    },
    remove: (id: string): void => {
      const before = pending.length;
      pending = pending.filter((item) => item.id !== id);
      if (pending.length < before)
        decMemoryCounter('pending-relay-request-queue');
      active.delete(id);
    },
    clear: (): void => {
      pending = [];
      active.clear();
      setMemoryCounter('pending-relay-request-queue', 0);
    },
  };
}
