import type { SettingRecord } from './settings-key';

export type SettingGroup = {
  readonly id: string;
  readonly title: string;
  readonly settings: readonly SettingRecord[];
};

const order = [
  'appearance',
  'workspace',
  'tabs',
  'timeline',
  'relays',
  'profiles',
  'posts',
  'accounts',
  'notifications',
  'composer',
  'cache',
  'security',
  'debug',
];

export function groupSettings(
  settings: readonly SettingRecord[],
): SettingGroup[] {
  return order
    .map((id) => ({
      id,
      title: title(id),
      settings: settings.filter((setting) => setting.namespace === id),
    }))
    .filter((group) => group.settings.length > 0);
}

function title(id: string): string {
  return id[0]?.toUpperCase() + id.slice(1);
}
