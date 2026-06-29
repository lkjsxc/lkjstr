import { describe, expect, test } from 'vitest';
import {
  acceptAllPrivacy,
  customizePrivacy,
  disabledPrivacyChoices,
  normalizePrivacyRecord,
  optionalProcessingAllowed,
  rejectAllPrivacy,
  withdrawPrivacy,
} from '../../../src/lib/privacy/consent';

describe('privacy consent reducer', () => {
  test('optional categories are disabled until explicit consent', () => {
    expect(optionalProcessingAllowed(undefined, 'cookies')).toBe(false);
    expect(rejectAllPrivacy(1).choices).toEqual(disabledPrivacyChoices);
  });

  test('accept all and customize persist only explicit choices', () => {
    const accepted = acceptAllPrivacy(2);
    expect(accepted.choices).toEqual({
      cookies: true,
      telemetry: true,
      nonEssentialStorage: true,
    });

    const custom = customizePrivacy(
      { cookies: true, telemetry: false, nonEssentialStorage: true },
      3,
    );
    expect(optionalProcessingAllowed(custom, 'cookies')).toBe(true);
    expect(optionalProcessingAllowed(custom, 'telemetry')).toBe(false);
  });

  test('withdrawal disables optional categories', () => {
    expect(withdrawPrivacy(4)).toEqual(rejectAllPrivacy(4));
  });

  test('invalid stored records normalize to disabled absence', () => {
    expect(normalizePrivacyRecord({ version: 2 })).toBeUndefined();
    expect(
      normalizePrivacyRecord({
        version: 1,
        updatedAt: 5,
        choices: { cookies: true, telemetry: 'yes' },
      }),
    ).toMatchObject({
      choices: { cookies: true, telemetry: false, nonEssentialStorage: false },
    });
  });
});
