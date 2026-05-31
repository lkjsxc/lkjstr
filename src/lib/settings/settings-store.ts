import {
  deleteSettingOverrideRow,
  deleteSettingOverrideRows,
  putSettingOverrideRow,
  readSettingOverrideRows,
  replaceSettingOverrideRows,
} from '../storage/repositories/settings-store';
import type { SettingRecord } from './settings-key';
import { defaultSettings, searchText } from './settings-schema';
import { settingsChangedEvent } from './settings-events';
import { validCustomUploadServer } from '../media/providers';
import { notifyHideSensitiveSettingChanged } from './hide-sensitive-events';
import { enforceBudgetIfDecreased } from './cache-budget-setting';
export { subscribeHideSensitiveEvents } from './hide-sensitive-events';

export type SettingOverride = {
  readonly key: string;
  readonly namespace: string;
  readonly value: unknown;
  readonly updatedAt: number;
};

let memoryOverrides: SettingOverride[] = [];
let settingsCache: Promise<SettingRecord[]> | undefined;

export async function loadSettings(): Promise<SettingRecord[]> {
  settingsCache ??= loadSettingsUncached();
  return settingsCache;
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
  await putSettingOverrideRow(override);
  settingsCache = undefined;
  notifySettingsChanged();
  const next = mergeSettings(memoryOverrides);
  enforceBudgetIfDecreased(settings, next);
  return next;
}

export async function resetSetting(key: string): Promise<SettingRecord[]> {
  const before = mergeSettings(memoryOverrides);
  memoryOverrides = memoryOverrides.filter((item) => item.key !== key);
  await deleteSettingOverrideRow(key);
  settingsCache = undefined;
  notifySettingsChanged();
  const next = mergeSettings(memoryOverrides);
  enforceBudgetIfDecreased(before, next);
  return next;
}

export async function resetNamespace(
  namespace: string,
): Promise<SettingRecord[]> {
  const before = mergeSettings(memoryOverrides);
  memoryOverrides = memoryOverrides.filter(
    (item) => item.namespace !== namespace,
  );
  const keys = defaultSettings()
    .filter((setting) => setting.namespace === namespace)
    .map((setting) => setting.key);
  await deleteSettingOverrideRows(keys);
  settingsCache = undefined;
  notifySettingsChanged();
  const next = mergeSettings(memoryOverrides);
  enforceBudgetIfDecreased(before, next);
  return next;
}

export async function importSettingsJson(
  raw: string,
): Promise<SettingRecord[]> {
  const before = mergeSettings(memoryOverrides);
  const parsed = JSON.parse(raw) as SettingRecord[];
  const byKey = new Map(
    defaultSettings().map((setting) => [setting.key, setting]),
  );
  const overrides = parsed.flatMap((item) => {
    const setting = byKey.get(item.key);
    if (!setting) return [];
    const clean = coerceValue(setting, item.value);
    if (!clean.ok) throw new Error(`invalid setting value: ${item.key}`);
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
  await replaceSettingOverrideRows(overrides);
  settingsCache = undefined;
  notifySettingsChanged();
  const next = mergeSettings(overrides);
  enforceBudgetIfDecreased(before, next);
  return next;
}

async function loadSettingsUncached(): Promise<SettingRecord[]> {
  const overrides = await readSettingOverrideRows(memoryOverrides);
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
    if (!Number.isFinite(n)) return { ok: false };
    if (setting.integer && !Number.isInteger(n)) return { ok: false };
    if (setting.min !== undefined && n < setting.min) return { ok: false };
    if (setting.max !== undefined && n > setting.max) return { ok: false };
    return { ok: true, value: n };
  }
  if (setting.valueType === 'enum')
    return setting.options?.includes(String(value))
      ? { ok: true, value: String(value) }
      : { ok: false };
  if (setting.valueType === 'json') return { ok: true, value };
  const text = String(value).trim();
  if (
    setting.key === 'tweet.mediaUploadCustomServer' &&
    !validCustomUploadServer(text)
  )
    return { ok: false };
  return { ok: true, value: text };
}

function notifySettingsChanged(): void {
  notifyHideSensitiveSettingChanged();
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(settingsChangedEvent));
}
