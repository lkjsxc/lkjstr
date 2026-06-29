export type PrivacyCategory = 'cookies' | 'telemetry' | 'nonEssentialStorage';

export type PrivacyChoices = Record<PrivacyCategory, boolean>;

export type PrivacyConsentRecord = {
  readonly version: 1;
  readonly choices: PrivacyChoices;
  readonly updatedAt: number;
};

export const disabledPrivacyChoices: PrivacyChoices = {
  cookies: false,
  telemetry: false,
  nonEssentialStorage: false,
};

const enabledPrivacyChoices: PrivacyChoices = {
  cookies: true,
  telemetry: true,
  nonEssentialStorage: true,
};

export function rejectAllPrivacy(now = Date.now()): PrivacyConsentRecord {
  return record(disabledPrivacyChoices, now);
}

export function acceptAllPrivacy(now = Date.now()): PrivacyConsentRecord {
  return record(enabledPrivacyChoices, now);
}

export function customizePrivacy(
  choices: PrivacyChoices,
  now = Date.now(),
): PrivacyConsentRecord {
  return record(choices, now);
}

export function withdrawPrivacy(now = Date.now()): PrivacyConsentRecord {
  return rejectAllPrivacy(now);
}

export function optionalProcessingAllowed(
  record: PrivacyConsentRecord | undefined,
  category: PrivacyCategory,
): boolean {
  return record?.choices[category] === true;
}

export function normalizePrivacyRecord(
  value: unknown,
): PrivacyConsentRecord | undefined {
  if (!isRecord(value) || value.version !== 1) return undefined;
  if (!isRecord(value.choices) || typeof value.updatedAt !== 'number')
    return undefined;
  return record(
    {
      cookies: value.choices.cookies === true,
      telemetry: value.choices.telemetry === true,
      nonEssentialStorage: value.choices.nonEssentialStorage === true,
    },
    value.updatedAt,
  );
}

function record(
  choices: PrivacyChoices,
  updatedAt: number,
): PrivacyConsentRecord {
  return { version: 1, choices: { ...choices }, updatedAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
