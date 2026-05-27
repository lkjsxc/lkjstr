export type OrchestrationMetrics = {
  readonly activeDemands: number;
  readonly activeLeases: number;
  readonly liveLeases: number;
  readonly bootstrapLeases: number;
  readonly relayReqTotal: number;
  readonly relayCloseTotal: number;
  readonly eventsReceived: number;
  readonly eventsAccepted: number;
  readonly eventsDroppedDuplicate: number;
  readonly eventsDroppedNonRenderCritical: number;
};

const metrics = {
  activeDemands: 0,
  activeLeases: 0,
  liveLeases: 0,
  bootstrapLeases: 0,
  relayReqTotal: 0,
  relayCloseTotal: 0,
  eventsReceived: 0,
  eventsAccepted: 0,
  eventsDroppedDuplicate: 0,
  eventsDroppedNonRenderCritical: 0,
};

export function orchestrationMetricsSnapshot(): OrchestrationMetrics {
  return { ...metrics };
}

export function resetOrchestrationMetrics(): void {
  metrics.activeDemands = 0;
  metrics.activeLeases = 0;
  metrics.liveLeases = 0;
  metrics.bootstrapLeases = 0;
  metrics.relayReqTotal = 0;
  metrics.relayCloseTotal = 0;
  metrics.eventsReceived = 0;
  metrics.eventsAccepted = 0;
  metrics.eventsDroppedDuplicate = 0;
  metrics.eventsDroppedNonRenderCritical = 0;
}

export function setOrchestrationGauge(
  key: keyof Pick<
    OrchestrationMetrics,
    'activeDemands' | 'activeLeases' | 'liveLeases' | 'bootstrapLeases'
  >,
  value: number,
): void {
  metrics[key] = Math.max(0, Math.floor(value));
}

export function incOrchestrationMetric(
  key: keyof Omit<
    OrchestrationMetrics,
    'activeDemands' | 'activeLeases' | 'liveLeases' | 'bootstrapLeases'
  >,
  delta = 1,
): void {
  metrics[key] += Math.max(0, Math.floor(delta));
}
