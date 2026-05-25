export type RelayFramePolicy = {
  readonly maxInboundTextBytes: number;
  readonly maxEventContentBytes: number;
  readonly maxEventTags: number;
  readonly maxTagFields: number;
  readonly maxTagFieldBytes: number;
};

export const defaultRelayFramePolicy: RelayFramePolicy = {
  maxInboundTextBytes: 1_048_576,
  maxEventContentBytes: 262_144,
  maxEventTags: 512,
  maxTagFields: 16,
  maxTagFieldBytes: 4096,
};
