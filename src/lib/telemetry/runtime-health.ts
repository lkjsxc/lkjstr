export type RuntimeHealth = {
  readonly activeTabs: number;
  readonly activeSubscriptions: number;
  readonly renderedRows: number;
  readonly workerQueueLength: number;
  readonly pendingProfileFetches: number;
  readonly updatedAt: number;
};

export function runtimeHealth(
  partial: Partial<Omit<RuntimeHealth, 'updatedAt'>> = {},
): RuntimeHealth {
  return {
    activeTabs: partial.activeTabs ?? 0,
    activeSubscriptions: partial.activeSubscriptions ?? 0,
    renderedRows: partial.renderedRows ?? 0,
    workerQueueLength: partial.workerQueueLength ?? 0,
    pendingProfileFetches: partial.pendingProfileFetches ?? 0,
    updatedAt: Date.now(),
  };
}
