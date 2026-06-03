export type RelayReadScoreKey = {
  readonly relayUrl: string;
  readonly surface: string;
  readonly phase: string;
  readonly direction: string;
  readonly routeGroupKey: string;
  readonly filterShape: string;
  readonly purpose: string;
};

export type RelayReadScoreInput = {
  readonly startedAtMs?: number;
  readonly firstEventMs?: number;
  readonly eoseMs?: number;
  readonly durationMs?: number;
  readonly eventCount: number;
  readonly uniqueEventCount?: number;
  readonly finalCount: number;
  readonly timeout?: boolean;
  readonly closed?: boolean;
  readonly auth?: boolean;
  readonly socketError?: boolean;
  readonly eventLimitReached?: boolean;
  readonly bytesSent?: number;
  readonly bytesReceived?: number;
  readonly updatedAt: number;
};

export type RelayReadScore = {
  readonly key: RelayReadScoreKey;
  readonly reliability: number;
  readonly firstEventSpeed: number;
  readonly eoseSpeed: number;
  readonly usefulYield: number;
  readonly uniqueYield: number;
  readonly penalty: number;
  readonly fairnessCredit: number;
  readonly score: number;
  readonly sampleCount: number;
  readonly updatedAt: number;
};

export type RelayReadScoreContext = Omit<RelayReadScoreKey, 'relayUrl'>;

export type RelayReadScoreStore = {
  readonly get: (key: RelayReadScoreKey) => RelayReadScore | undefined;
  readonly set: (score: RelayReadScore) => void;
};
