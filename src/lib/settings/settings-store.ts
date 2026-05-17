import { browserDb } from '../storage/browser-db';
import type { SettingRecord } from './settings-key';
import { defaultSettings, searchText } from './settings-schema';

export type SettingOverride = {
  readonly key: string;
  readonly namespace: string;
  readonly value: unknown;
  readonly updatedAt: number;
};

let memoryOverrides: SettingOverride[] = [];

export async function loadSettings(): Promise<SettingRecord[]> {
  const overrides = await browserDb()
    .settings.toArray()
    .catch(() => memoryOverrides);
  return mergeSettings(overrides);
}

export async function saveSetting(
  settings: readonly SettingRecord[],
  key: string,
  value: unknown,
): Promise<SettingRecord[]> {
  const current = settings.find((setting) => setting.key === key);
  if (!current) return [...settings];
  const clean = coerceValue(current, value);
  if (!clean.ok) return [...settings];
  const override = {
    key,
    namespace: current.namespace,
    value: clean.value,
    updatedAt: Date.now(),
  };
  memoryOverrides = [
    ...memoryOverrides.filter((item) => item.key !== key),
    override,
  ];
  await browserDb()
    .settings.put(override)
    .catch(() => undefined);
  return mergeSettings(memoryOverrides);
}

export async function resetSetting(key: string): Promise<SettingRecord[]> {
  memoryOverrides = memoryOverrides.filter((item) => item.key !== key);
  await browserDb()
    .settings.delete(key)
    .catch(() => undefined);
  return mergeSettings(memoryOverrides);
}

export async function resetNamespace(
  namespace: string,
): Promise<SettingRecord[]> {
  memoryOverrides = memoryOverrides.filter(
    (item) => item.namespace !== namespace,
  );
  const keys = defaultSettings()
    .filter((setting) => setting.namespace === namespace)
    .map((setting) => setting.key);
  await browserDb()
    .settings.bulkDelete(keys)
    .catch(() => undefined);
  return mergeSettings(memoryOverrides);
}

export async function importSettingsJson(
  raw: string,
): Promise<SettingRecord[]> {
  const parsed = JSON.parse(raw) as SettingRecord[];
  const byKey = new Map(
    defaultSettings().map((setting) => [setting.key, setting]),
  );
  const overrides = parsed.flatMap((item) => {
    const setting = byKey.get(item.key);
    if (!setting) return [];
    const clean = coerceValue(setting, item.value);
    return clean.ok
      ? [
          {
            key: item.key,
            namespace: setting.namespace,
            value: clean.value,
            updatedAt: Date.now(),
          },
        ]
      : [];
  });
  memoryOverrides = overrides;
  await browserDb()
    .settings.clear()
    .catch(() => undefined);
  await browserDb()
    .settings.bulkPut(overrides)
    .catch(() => undefined);
  return mergeSettings(overrides);
}

export function mergeSettings(
  overrides: readonly SettingOverride[],
): SettingRecord[] {
  const byKey = new Map(overrides.map((override) => [override.key, override]));
  return defaultSettings(Date.now()).map((setting) => {
    const override = byKey.get(setting.key);
    const value = override?.value ?? setting.defaultValue;
    return {
      ...setting,
      value,
      searchableText: searchText(
        setting.key,
        setting.namespace,
        setting.label,
        setting.description,
        value,
      ),
      updatedAt: override?.updatedAt ?? setting.updatedAt,
    };
  });
}

export function coerceValue(
  setting: SettingRecord,
  value: unknown,
): { ok: true; value: unknown } | { ok: false } {
  if (setting.valueType === 'boolean')
    return { ok: true, value: Boolean(value) };
  if (setting.valueType === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (setting.valueType === 'enum')
    return setting.options?.includes(String(value))
      ? { ok: true, value: String(value) }
      : { ok: false };
  if (setting.valueType === 'json') return { ok: true, value };
  return { ok: true, value: String(value) };
}
