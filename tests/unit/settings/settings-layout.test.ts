import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';
import { searchSettings } from '../../../src/lib/settings/settings-search';

describe('settings layout schema', () => {
  it('contains workspace, tile, timeline, relay, and inspector keys', () => {
    const keys = defaultSettings().map((setting) => setting.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'workspace.sidebarVisible',
        'tiles.smartSplitSameDirection',
        'tabs.openSource',
        'timeline.initialLimit',
        'timeline.showRelayProvenance',
        'relays.connectTimeoutMs',
        'settings.showInspector',
      ]),
    );
  });

  it('searches timeline and split behavior keys', () => {
    const settings = defaultSettings();
    expect(searchSettings(settings, 'relay provenance')[0]?.key).toBe(
      'timeline.showRelayProvenance',
    );
    expect(searchSettings(settings, 'smart split')[0]?.key).toBe(
      'tiles.smartSplitSameDirection',
    );
  });
});
