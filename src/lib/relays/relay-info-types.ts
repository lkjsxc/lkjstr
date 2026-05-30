export type RelayLimitation = {
  readonly maxMessageLength?: number;
  readonly maxSubscriptions?: number;
  readonly maxLimit?: number;
  readonly maxSubIdLength?: number;
  readonly maxEventTags?: number;
  readonly maxContentLength?: number;
  readonly minPowDifficulty?: number;
  readonly authRequired?: boolean;
  readonly paymentRequired?: boolean;
  readonly restrictedWrites?: boolean;
  readonly createdAtLowerLimit?: number;
  readonly createdAtUpperLimit?: number;
  readonly defaultLimit?: number;
};

export type RelayInformationDocument = {
  readonly name?: string;
  readonly description?: string;
  readonly banner?: string;
  readonly icon?: string;
  readonly pubkey?: string;
  readonly self?: string;
  readonly contact?: string;
  readonly supported_nips?: readonly number[];
  readonly software?: string;
  readonly version?: string;
  readonly terms_of_service?: string;
  readonly payments_url?: string;
  readonly limitation?: RelayLimitation;
  readonly fees?: Record<string, unknown>;
};

export type RelayInformationRecord = {
  readonly relayUrl: string;
  readonly fetchedAt: number;
  readonly status: 'available' | 'unavailable';
  readonly info?: RelayInformationDocument;
  readonly error?: string;
};
