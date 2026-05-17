import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';
import {
  coerceValue,
  mergeSettings,
} from '../../../src/lib/settings/settings-store';

describe('settings store helpers', () => {
  it('merges overrides into effective settings', () => {
    const updatedAt = 123;
    const settings = mergeSettings([
      {
        key: 'appearance.cornerRadius',
        namespace: 'appearance',
        value: 1,
        updatedAt,
      },
    ]);
    const button = settings.find(
      (item) => item.key === 'appearance.cornerRadius',
    );
    expect(button?.value).toBe(1);
    expect(button?.updatedAt).toBe(updatedAt);
  });

  it('rejects invalid enum values', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'appearance.theme',
    );
    if (!setting) throw new Error('expected setting');
    expect(coerceValue(setting, 'light')).toEqual({ ok: false });
  });
});
