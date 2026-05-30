import type {
  RelayInformationDocument,
  RelayLimitation,
} from './relay-info-types';

export function parseRelayInformation(
  value: unknown,
): RelayInformationDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Relay information is not a JSON object.');
  }
  const record = value as Record<string, unknown>;
  return compactRecord({
    name: stringField(record.name),
    description: stringField(record.description),
    banner: stringField(record.banner),
    icon: stringField(record.icon),
    pubkey: hexPubkey(record.pubkey),
    self: hexPubkey(record.self),
    contact: stringField(record.contact),
    supported_nips: numberArray(record.supported_nips),
    software: stringField(record.software),
    version: stringField(record.version),
    terms_of_service: stringField(record.terms_of_service),
    payments_url: stringField(record.payments_url),
    limitation: limitationField(record.limitation),
    fees: objectField(record.fees),
  });
}

function limitationField(value: unknown): RelayLimitation | undefined {
  const record = objectField(value);
  if (!record) return undefined;
  return compactRecord({
    maxMessageLength: positiveInt(record.max_message_length),
    maxSubscriptions: positiveInt(record.max_subscriptions),
    maxLimit: positiveInt(record.max_limit),
    maxSubIdLength:
      positiveInt(record.max_subid_length) ??
      positiveInt(record.max_subscription_id_length),
    maxEventTags: positiveInt(record.max_event_tags),
    maxContentLength: positiveInt(record.max_content_length),
    minPowDifficulty: positiveInt(record.min_pow_difficulty),
    authRequired: booleanField(record.auth_required),
    paymentRequired: booleanField(record.payment_required),
    restrictedWrites: booleanField(record.restricted_writes),
    createdAtLowerLimit: positiveInt(record.created_at_lower_limit),
    createdAtUpperLimit: positiveInt(record.created_at_upper_limit),
    defaultLimit: positiveInt(record.default_limit),
  });
}

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as T;
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function hexPubkey(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
    ? value
    : undefined;
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function positiveInt(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : undefined;
}

function numberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter(
    (item): item is number => Number.isInteger(item) && item >= 0,
  );
  return out.length > 0 ? out : undefined;
}

function objectField(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
