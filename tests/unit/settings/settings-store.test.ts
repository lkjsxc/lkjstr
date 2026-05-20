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

  it('coerces Tweet media upload server settings', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'tweet.mediaUploadServer',
    );
    if (!setting) throw new Error('expected setting');
    expect(coerceValue(setting, '')).toEqual({ ok: true, value: '' });
    expect(coerceValue(setting, 'https://media.example')).toEqual({
      ok: true,
      value: 'https://media.example',
    });
    expect(coerceValue(setting, 'http://media.example')).toEqual({
      ok: false,
    });
  });

  it('coerces inactive tab retention within documented bounds', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'tabs.inactiveRetentionSeconds',
    );
    if (!setting) throw new Error('expected setting');
    expect(setting).toMatchObject({
      defaultValue: 300,
      min: 0,
      max: 3600,
      integer: true,
    });
    expect(coerceValue(setting, 0)).toEqual({ ok: true, value: 0 });
    expect(coerceValue(setting, 3601)).toEqual({ ok: false });
    expect(coerceValue(setting, 1.5)).toEqual({ ok: false });
  });

  it('rejects invalid imported values', async () => {
    await expect(
      importSettingsJson(
        JSON.stringify([{ key: 'cache.maxAgeDays', value: 0 }]),
      ),
    ).rejects.toThrow(/invalid setting value/);
  });
});
