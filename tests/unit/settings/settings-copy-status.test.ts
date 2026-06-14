import { describe, expect, it } from 'vitest';
import {
  copySettingsJson,
  settingsCopyStatusText,
} from '../../../src/lib/tabs/settings/settings-copy-status';

describe('settings copy status', () => {
  it('reports copied only after clipboard write succeeds', async () => {
    const clipboard = {
      writes: [] as string[],
      async writeText(value: string) {
        this.writes.push(value);
      },
    };
    const status = await copySettingsJson(
      'Settings JSON export',
      '[]',
      clipboard,
    );

    expect(clipboard.writes).toEqual(['[]']);
    expect(status).toEqual({
      kind: 'copied',
      label: 'Settings JSON export',
    });
    expect(settingsCopyStatusText(status)).toBe('Settings JSON export copied.');
  });

  it('reports unavailable clipboard without claiming copied status', async () => {
    const status = await copySettingsJson(
      'Settings JSON export',
      '[]',
      undefined,
    );

    expect(status).toEqual({
      kind: 'failed',
      label: 'Settings JSON export',
      reason: 'Clipboard unavailable',
    });
    expect(settingsCopyStatusText(status)).toBe(
      'Settings JSON export copy failed: Clipboard unavailable',
    );
  });

  it('reports clipboard rejection without claiming copied status', async () => {
    const status = await copySettingsJson('Settings JSON export', '[]', {
      writeText: async () => {
        throw new Error('denied');
      },
    });

    expect(status).toEqual({
      kind: 'failed',
      label: 'Settings JSON export',
      reason: 'denied',
    });
    expect(settingsCopyStatusText(status)).toBe(
      'Settings JSON export copy failed: denied',
    );
  });
});
