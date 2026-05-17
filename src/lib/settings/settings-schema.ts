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
appearance.neutralPalette|Neutral palette|enum|dark-neutral|Primary color palette.|dark-neutral,light-neutral
appearance.cornerRadius|Corner radius|number|2|Global corner radius.
appearance.showAvatars|Show avatars|boolean|true|Render avatars.
workspace.route|Route|string|/|Canonical workspace route.
workspace.autoRecoverZeroPanels|Recover workspace|boolean|true|Recover when no tile remains.
workspace.closeTileWhenLastTabCloses|Close empty tile|boolean|true|Close tile after final tab.
workspace.sidebarVisible|Sidebar visible|boolean|true|Show workspace sidebar.
tiles.defaultSplitDirection|Split direction|enum|horizontal|Default split direction.|horizontal,vertical
tiles.smartSplitSameDirection|Smart split|boolean|true|Insert into same-direction split.
tiles.closeRemovesSubscriptions|Close cleanup|boolean|true|Close tile subscriptions.
tiles.menuActions|Menu actions|json|["Split right","Split down","Tile close"]|Tile menu actions.
tabs.openSource|Tab open source|enum|sidebar|Where tabs open from.|sidebar
tabs.closeLastTabBehavior|Last tab|enum|close-tile|Close final tab behavior.|close-tile
timeline.defaultKind|Timeline kind|number|1|Default event kind.
timeline.initialLimit|Timeline limit|number|50|Initial timeline event limit.
timeline.useDefaultRelays|Use defaults|boolean|true|Use default relays when needed.
timeline.cacheFirst|Cache first|boolean|true|Load cached events before relays.
timeline.showRelayProvenance|Relay provenance|boolean|true|Show event relay source.
relays.defaultSet|Default relays|json|["wss://relay.damus.io","wss://nos.lol","wss://relay.primal.net","wss://relay.nostr.band","wss://offchain.pub"]|Default relay URLs.
relays.seedOnFirstBoot|Seed relays|boolean|true|Seed relays when empty.
relays.connectTimeoutMs|Connect timeout|number|5000|Relay connect timeout.
relays.reconnectBackoffMs|Reconnect backoff|number|1500|Relay reconnect backoff.
notifications.enabled|Notifications|boolean|true|Enable notifications.
notifications.showUnreadInTab|Unread tab|boolean|true|Show unread in tab.
notifications.defaultCategories|Categories|json|["mentions"]|Notification categories.
composer.defaultPublishMode|Publish mode|enum|selected-relays|Composer publish target.|selected-relays
cache.maxEvents|Max events|number|50000|Cached event limit.
cache.compactionEnabled|Compaction|boolean|true|Enable compaction.
cache.pruneDrafts|Prune drafts|boolean|false|Prune drafts automatically.
accounts.defaultMode|Account mode|enum|read-only|Default account mode.|read-only,nip07
security.allowLocalNsecImport|Local nsec|boolean|false|Allow local nsec import.
security.logSensitiveValues|Sensitive logs|boolean|false|Log sensitive values.
settings.searchMode|Search mode|enum|contains|Settings search mode.|contains
settings.showInspector|Show inspector|boolean|true|Show selected key inspector.
settings.compactNarrowLayout|Compact narrow|boolean|true|Use compact narrow layout.
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
