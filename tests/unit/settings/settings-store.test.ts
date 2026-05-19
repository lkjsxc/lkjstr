import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';
import {
  coerceValue,
  importSettingsJson,
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

  it('enforces numeric bounds', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'cache.maxEvents',
    );
    if (!setting) throw new Error('expected setting');
    expect(setting).toMatchObject({ min: 100, integer: true });
    expect(coerceValue(setting, 50)).toEqual({ ok: false });
    expect(coerceValue(setting, 5000)).toEqual({ ok: true, value: 5000 });
  });

  it('rejects invalid imported values', async () => {
    await expect(
      importSettingsJson(
        JSON.stringify([{ key: 'cache.maxAgeDays', value: 0 }]),
      ),
    ).rejects.toThrow(/invalid setting value/);
  });
});
