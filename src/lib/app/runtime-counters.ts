export type RuntimeCounterSnapshot = {
  readonly key: string;
  readonly created: number;
  readonly closed: number;
  readonly active: number;
  readonly events: number;
  readonly pageReads: number;
  readonly lastUpdatedAt: number;
};

type MutableCounter = {
  created: number;
  closed: number;
  active: number;
  events: number;
  pageReads: number;
  lastUpdatedAt: number;
};

let enabled = false;
const counters = new Map<string, MutableCounter>();

export function setRuntimeCountersEnabled(value: boolean): void {
  enabled = value;
  if (!enabled) counters.clear();
}

export function runtimeCountersEnabled(): boolean {
  return enabled;
}

type CountedRuntimeField = Exclude<keyof MutableCounter, 'lastUpdatedAt'>;

export function countRuntime(key: string, field: CountedRuntimeField): void {
  if (!enabled) return;
  const counter = counters.get(key) ?? emptyCounter();
  counter[field]++;
  counter.lastUpdatedAt = Date.now();
  counters.set(key, counter);
}

export function setRuntimeCounterActive(key: string, delta: 1 | -1): void {
  if (!enabled) return;
  const counter = counters.get(key) ?? emptyCounter();
  counter.active = Math.max(0, counter.active + delta);
  counter.lastUpdatedAt = Date.now();
  counters.set(key, counter);
}

export function runtimeCounterSnapshots(): RuntimeCounterSnapshot[] {
  return [...counters.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function emptyCounter(): MutableCounter {
  return {
    created: 0,
    closed: 0,
    active: 0,
    events: 0,
    pageReads: 0,
    lastUpdatedAt: Date.now(),
  };
}
