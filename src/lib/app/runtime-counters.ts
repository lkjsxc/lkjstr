export type RuntimeCounterSnapshot = {
  readonly key: string;
  readonly created: number;
  readonly closed: number;
  readonly active: number;
  readonly events: number;
  readonly pageReads: number;
  readonly scanReads: number;
  readonly storedEvents: number;
  readonly denseWindows: number;
  readonly incompleteWindows: number;
  readonly splitWindows: number;
  readonly grownWindows: number;
  readonly denseSegments: number;
  readonly unresolvedSegments: number;
  readonly coverageCompleteSegments: number;
  readonly coverageIncompleteSegments: number;
  readonly selectedFallbackGroups: number;
  readonly targetedGroups: number;
  readonly completedCoverageWindows: number;
  readonly lastUpdatedAt: number;
};

type MutableCounter = {
  created: number;
  closed: number;
  active: number;
  events: number;
  pageReads: number;
  scanReads: number;
  storedEvents: number;
  denseWindows: number;
  incompleteWindows: number;
  splitWindows: number;
  grownWindows: number;
  denseSegments: number;
  unresolvedSegments: number;
  coverageCompleteSegments: number;
  coverageIncompleteSegments: number;
  selectedFallbackGroups: number;
  targetedGroups: number;
  completedCoverageWindows: number;
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
    scanReads: 0,
    storedEvents: 0,
    denseWindows: 0,
    incompleteWindows: 0,
    splitWindows: 0,
    grownWindows: 0,
    denseSegments: 0,
    unresolvedSegments: 0,
    coverageCompleteSegments: 0,
    coverageIncompleteSegments: 0,
    selectedFallbackGroups: 0,
    targetedGroups: 0,
    completedCoverageWindows: 0,
    lastUpdatedAt: Date.now(),
  };
}
