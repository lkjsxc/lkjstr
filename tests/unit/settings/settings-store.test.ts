import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';
import {
  coerceValue,
  importSettingsJson,
  mergeSettings,
  saveSetting,
  subscribeHideSensitiveEvents,
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
      (item) => item.key === 'timeline.initialLimit',
    );
    if (!setting) throw new Error('expected setting');
    expect(setting).toMatchObject({ min: 10, integer: true });
    expect(coerceValue(setting, 5)).toEqual({ ok: false });
    expect(coerceValue(setting, 50)).toEqual({ ok: true, value: 50 });
  });

  it('coerces cache byte budget within bounds', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'cache.maxBytes',
    );
    if (!setting) throw new Error('expected setting');
    expect(setting).toMatchObject({
      defaultValue: 67_108_864,
      min: 1_048_576,
      max: 10_737_418_240,
      step: 1_048_576,
      integer: true,
    });
    expect(coerceValue(setting, 1_048_576)).toEqual({
      ok: true,
      value: 1_048_576,
    });
    expect(coerceValue(setting, 1_073_741_824)).toEqual({
      ok: true,
      value: 1_073_741_824,
    });
    expect(coerceValue(setting, 1)).toEqual({ ok: false });
  });

  it('describes cache max bytes as a site storage target', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'cache.maxBytes',
    );
    expect(setting).toMatchObject({
      label: 'Site storage budget',
      description: 'Target site storage bytes.',
    });
  });

  it('coerces Tweet media upload provider settings', () => {
    const provider = defaultSettings().find(
      (item) => item.key === 'tweet.mediaUploadProvider',
    );
    if (!provider) throw new Error('expected setting');
    expect(provider.defaultValue).toBe('nostr-build');
    expect(coerceValue(provider, 'nostr-build')).toEqual({
      ok: true,
      value: 'nostr-build',
    });
    expect(coerceValue(provider, 'legacy')).toEqual({ ok: false });
  });

  it('coerces Tweet custom media upload server settings', () => {
    const setting = defaultSettings().find(
      (item) => item.key === 'tweet.mediaUploadCustomServer',
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

  it('does not expose relay-list JSON ownership settings', () => {
    const keys = defaultSettings().map((setting) => setting.key);
    expect(keys).not.toContain('timeline.defaultRelays');
    expect(keys).not.toContain('relays.defaultSet');
  });

  it('rejects invalid imported values', async () => {
    await expect(
      importSettingsJson(
        JSON.stringify([{ key: 'timeline.initialLimit', value: 0 }]),
      ),
    ).rejects.toThrow(/invalid setting value/);
  });

  it('fans out hide-sensitive setting updates', async () => {
    const seen: boolean[] = [];
    let resolveFalse!: () => void;
    const falseSeen = new Promise<void>((resolve) => {
      resolveFalse = resolve;
    });
    const unsubscribe = subscribeHideSensitiveEvents((value) => {
      seen.push(value);
      if (value === false) resolveFalse();
    });
    const settings = defaultSettings();
    await saveSetting(settings, 'content.hideSensitiveEvents', false);
    await falseSeen;
    unsubscribe();

    expect(seen).toContain(false);
  });
});
