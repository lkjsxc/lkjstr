export type ScanModelScope =
  | 'Exact'
  | 'RouteGroup'
  | 'RelayFilter'
  | 'SurfaceFilter'
  | 'Surface'
  | 'Global'
  | 'Neutral';

export type ScanModelContext = {
  readonly semanticFeedKey: string;
  readonly routeGroupKey: string;
  readonly relayUrl: string;
  readonly semanticFilterKey: string;
  readonly direction: 'older' | 'newer';
  readonly routeFingerprint: string;
};

export type ScanDensityModelRecord = ScanModelContext & {
  readonly modelKey: string;
  readonly scope: ScanModelScope;
  readonly targetLimitFraction: string;
  readonly densityEventsPerSecond: number;
  readonly sampleWeight: number;
  readonly updatedAtMs: number;
  readonly decaysAfterMs: number;
  readonly completeWindowCount?: number;
  readonly denseWindowCount?: number;
  readonly sparseWindowCount?: number;
  readonly incompleteWindowCount?: number;
  readonly failureWindowCount?: number;
  readonly limitHitRate?: number;
  readonly incompleteRate?: number;
  readonly lastGoodSpanSeconds?: number;
  readonly lastProposedSpanSeconds?: number;
  readonly recordJson?: unknown;
};

export type ScanObservationRecord = ScanModelContext & {
  readonly id: string;
  readonly createdAtMs: number;
  readonly recordJson: unknown;
};

export type ScanDecisionTraceRecord = {
  readonly traceId: string;
  readonly modelKey: string;
  readonly semanticFeedKey: string;
  readonly direction: 'older' | 'newer';
  readonly createdAtMs: number;
  readonly recordJson: unknown;
};
