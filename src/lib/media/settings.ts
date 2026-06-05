import { loadSettings, saveSetting } from '../settings/settings-store';
import type { SettingRecord } from '../settings/settings-key';
import {
  cleanUploadProvider,
  providerProtocol,
  providerServer,
  validCustomUploadServer,
  type MediaUploadProvider,
  type MediaUploadProtocol,
} from './providers';

export type UploadSettings = {
  readonly provider: MediaUploadProvider;
  readonly customServer: string;
  readonly server: string;
  readonly protocol: MediaUploadProtocol;
  readonly noTransform: boolean;
};

export async function loadUploadSettingRecords(): Promise<SettingRecord[]> {
  return (await loadSettings()).filter((setting) =>
    setting.key.startsWith('tweet.mediaUpload'),
  );
}

export async function loadUploadSettings(): Promise<UploadSettings> {
  const settings = await loadSettings();
  const provider = cleanUploadProvider(
    value(settings, 'tweet.mediaUploadProvider'),
  );
  const customServer = String(
    value(settings, 'tweet.mediaUploadCustomServer') ?? '',
  );
  return {
    provider,
    customServer,
    server: providerServer(provider, customServer),
    protocol: providerProtocol(provider),
    noTransform: value(settings, 'tweet.mediaUploadNoTransform') !== false,
  };
}

export async function saveUploadProvider(
  value: MediaUploadProvider,
): Promise<void> {
  await saveUploadSetting('tweet.mediaUploadProvider', value);
}

export async function saveUploadCustomServer(value: string): Promise<void> {
  if (!validCustomUploadServer(value)) return;
  await saveUploadSetting('tweet.mediaUploadCustomServer', value);
}

export async function saveUploadNoTransform(value: boolean): Promise<void> {
  await saveUploadSetting('tweet.mediaUploadNoTransform', value);
}

async function saveUploadSetting(key: string, value: unknown): Promise<void> {
  await saveSetting(await loadSettings(), key, value);
}

function value(settings: readonly SettingRecord[], key: string): unknown {
  return settings.find((setting) => setting.key === key)?.value;
}
