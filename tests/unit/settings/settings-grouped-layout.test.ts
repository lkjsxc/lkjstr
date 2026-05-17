import { describe, expect, it } from 'vitest';
import { groupSettings } from '../../../src/lib/settings/settings-groups';
import { defaultSettings } from '../../../src/lib/settings/settings-schema';

describe('settings grouped layout', () => {
  it('contains grouped key-value settings without search-only keys', () => {
    const settings = defaultSettings();
    const keys = settings.map((setting) => setting.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'workspace.recoverLastTile',
        'tabs.newTabChooserEnabled',
        'timeline.initialLimit',
        'timeline.showRelayProvenance',
        'profiles.fetchMetadata',
        'posts.persistDrafts',
      ]),
    );
    expect(keys).not.toContain('settings.searchMode');
    expect(keys).not.toContain('workspace.sidebarVisible');
  });

  it('keeps stable sections and does not filter records', () => {
    const settings = defaultSettings();
    const groups = groupSettings(settings);
    expect(groups.map((group) => group.id).slice(0, 4)).toEqual([
      'appearance',
      'workspace',
      'tabs',
      'timeline',
    ]);
    expect(groups.flatMap((group) => group.settings)).toHaveLength(
      settings.length,
    );
  });
});
