import type { SettingRecord } from './settings-key';

export function searchSettings(
  settings: readonly SettingRecord[],
  query: string,
  namespace = 'all',
): SettingRecord[] {
  const q = query.trim().toLowerCase();
  return settings.filter((setting) => {
    const namespaceMatch =
      namespace === 'all' || setting.namespace === namespace;
    const queryMatch = !q || setting.searchableText.includes(q);
    return namespaceMatch && queryMatch;
  });
}

export function settingNamespaces(
  settings: readonly SettingRecord[],
): string[] {
  return [
    'all',
    ...Array.from(new Set(settings.map((setting) => setting.namespace))),
  ];
}
