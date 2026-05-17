import type { SettingRecord, SettingValueType } from './settings-key';

type RawSetting = {
  key: string;
  label: string;
  valueType: SettingValueType;
  rawDefault: string;
  description: string;
  options?: readonly string[];
};

const rows = `
appearance.theme|Theme|enum|dark|Visual theme.|dark
appearance.radius.ui|UI radius|number|2|General radius.
appearance.radius.button|Button radius|number|2|Button radius.
appearance.radius.tab|Tab radius|number|1|Tab radius.
appearance.density|Density|enum|compact|Interface density.|compact,comfortable
appearance.showAvatars|Show avatars|boolean|true|Render avatars.
appearance.showUsernames|Show usernames|boolean|true|Render names.
workspace.route|Route|string|/|Canonical workspace route.
workspace.emptyStateMode|Empty state|enum|empty-pane|Final tab behavior.|empty-pane
workspace.defaultSplitCount|Split count|number|2|Default split count.
workspace.persistLayout|Persist layout|boolean|true|Save layout.
workspace.restoreOnBoot|Restore on boot|boolean|true|Restore workspace.
panes.minWidth|Minimum width|number|240|Minimum pane width.
panes.minHeight|Minimum height|number|180|Minimum pane height.
panes.defaultSplitDirection|Split direction|enum|horizontal|Default split direction.|horizontal,vertical
panes.defaultSplitCount|Pane split count|number|2|Default pane split count.
panes.resizeStep|Resize step|number|0.04|Keyboard resize step.
tabs.closeLastTabBehavior|Last tab|enum|empty-pane|Close final tab behavior.|empty-pane
tabs.showUnreadCount|Unread count|boolean|true|Show unread count.
tabs.showAvatarInTab|Tab avatar|boolean|false|Show tab avatar.
tabs.previewTabEnabled|Preview tabs|boolean|false|Enable previews.
relays.defaultSetId|Default set|string|public-default|Default relay set id.
relays.seedDefaultsOnFirstBoot|Seed relays|boolean|true|Seed when empty.
relays.connectLazily|Lazy connect|boolean|true|Connect only on demand.
relays.defaultInitialLimit|Initial limit|number|100|Initial event limit.
notifications.enabled|Notifications|boolean|true|Enable notifications.
notifications.showUnreadInTab|Unread tab|boolean|true|Show unread in tab.
notifications.defaultCategories|Categories|json|["mentions"]|Notification categories.
composer.defaultPublishMode|Publish mode|enum|selected-relays|Composer publish target.|selected-relays
cache.maxEvents|Max events|number|50000|Cached event limit.
cache.compactionEnabled|Compaction|boolean|true|Enable compaction.
cache.pruneDrafts|Prune drafts|boolean|false|Prune drafts automatically.
security.allowLocalNsecImport|Local nsec|boolean|false|Allow local nsec import.
security.logSensitiveValues|Sensitive logs|boolean|false|Log sensitive values.
debug.showRuntimeCounters|Runtime counters|boolean|false|Show runtime counters.
debug.showRawEventActions|Raw event actions|boolean|false|Show raw event actions.
`;

const items: readonly RawSetting[] = rows
  .trim()
  .split('\n')
  .map((row) => {
    const [key, label, valueType, rawDefault, description, rawOptions] =
      row.split('|');
    return {
      key: key ?? '',
      label: label ?? '',
      valueType: valueType as SettingValueType,
      rawDefault: rawDefault ?? '',
      description: description ?? '',
      options: rawOptions?.split(','),
    };
  });

export function defaultSettings(now = 0): SettingRecord[] {
  return items.map((item) => {
    const namespace = item.key.split('.')[0] ?? 'debug';
    const value = parseDefault(item);
    return {
      key: item.key,
      namespace,
      label: item.label,
      description: item.description,
      valueType: item.valueType,
      defaultValue: value,
      value,
      options: item.options,
      requiresReload: item.key === 'workspace.route',
      sensitive: item.key.startsWith('security.'),
      searchableText: searchText(
        item.key,
        namespace,
        item.label,
        item.description,
        value,
      ),
      updatedAt: now,
    };
  });
}

export function searchText(...parts: unknown[]): string {
  return parts
    .map((part) => JSON.stringify(part) ?? '')
    .join(' ')
    .toLowerCase();
}

function parseDefault(item: RawSetting): unknown {
  if (item.valueType === 'boolean') return item.rawDefault === 'true';
  if (item.valueType === 'number') return Number(item.rawDefault);
  if (item.valueType === 'json') return JSON.parse(item.rawDefault);
  return item.rawDefault;
}
