import type { SettingRecord, SettingValueType } from './settings-key';

type RawSetting = {
  key: string;
  label: string;
  valueType: SettingValueType;
  rawDefault: string;
  description: string;
  options?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
};

const rows = `
appearance.theme|Theme|enum|dark|Visual theme.|dark
appearance.cornerRadius|Corner radius|number|2|Global corner radius.
appearance.showAvatars|Show avatars|boolean|true|Render avatars.
workspace.recoverLastTile|Recover last tile|boolean|true|Recover one tile when none remain.
workspace.defaultTabKind|Default tab|enum|timeline|Recovery tab kind.|timeline,new-tab
tabs.closeLastTabClosesTile|Close empty tile|boolean|true|Close tile after final tab.
tabs.newTabChooserEnabled|New Tab chooser|boolean|true|Use per-tile tab chooser.
tabs.inactiveRetentionSeconds|Inactive tab retention|number|300|Seconds to retain inactive tab runtimes.
timeline.initialLimit|Timeline limit|number|50|Initial timeline event limit.
timeline.showRelayProvenance|Relay provenance|boolean|true|Show event relay source.
cache.maxBytes|Site storage budget|number|67108864|Target site storage bytes.
relays.connectTimeoutMs|Connect timeout|number|5000|Relay connect timeout.
profiles.fetchMetadata|Fetch metadata|boolean|true|Fetch profile metadata from relays.
profiles.showNip05|Show NIP-05|boolean|true|Show NIP-05 identifiers.
notifications.enabled|Notifications|boolean|true|Enable notifications.
notifications.defaultCategories|Categories|json|["mentions"]|Notification categories.
content.hideSensitiveEvents|Hide sensitive events|boolean|true|Hide NIP-36 content until revealed.
tweet.defaultPublishMode|Publish mode|enum|selected-relays|Tweet publish target.|selected-relays
tweet.mediaUploadProvider|Media upload provider|enum|blossom|Media upload provider.|disabled,blossom,nostr-build,nostrcheck,void-cat,custom
tweet.mediaUploadCustomServer|Custom upload server|string||Optional HTTPS media upload server.
tweet.mediaUploadNoTransform|No transform upload|boolean|true|Request original media upload.
accounts.defaultMode|Account mode|enum|read-only|Default account mode.|read-only,nip07
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

const numericConstraints: Record<
  string,
  Pick<RawSetting, 'min' | 'max' | 'step' | 'integer'>
> = {
  'appearance.cornerRadius': { min: 0, max: 16, step: 1, integer: true },
  'tabs.inactiveRetentionSeconds': {
    min: 0,
    max: 3600,
    step: 1,
    integer: true,
  },
  'timeline.initialLimit': { min: 10, max: 180, step: 1, integer: true },
  'cache.maxBytes': {
    min: 1048576,
    max: 10737418240,
    step: 1048576,
    integer: true,
  },
  'relays.connectTimeoutMs': { min: 500, max: 30000, step: 100, integer: true },
};

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
      ...numericConstraints[item.key],
      requiresReload: false,
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
