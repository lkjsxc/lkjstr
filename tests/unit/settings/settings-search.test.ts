import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';
import { searchSettings } from '../../../src/lib/settings/settings-search';

describe('settings search', () => {
  it('matches namespace, key, and description', () => {
    const settings = defaultSettings();
    expect(searchSettings(settings, '', 'relays')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'relays.defaultSet' }),
      ]),
    );
    expect(searchSettings(settings, 'workspace.route')[0]?.key).toBe(
      'workspace.route',
    );
    expect(searchSettings(settings, 'Corner radius')[0]?.key).toBe(
      'appearance.cornerRadius',
    );
  });
});
