import { loadSettings } from '../settings/settings-store';
import type { UploadSettings } from './media-upload';
import {
  isUploadProvider,
  providerServer,
  type TweetMediaUploadProvider,
} from './media-upload-providers';

export async function loadTweetUploadSettings(): Promise<UploadSettings> {
  const settings = await loadSettings();
  const rawProvider = settings.find(
    (item) => item.key === 'tweet.mediaUploadProvider',
  )?.value;
  const provider: TweetMediaUploadProvider = isUploadProvider(rawProvider)
    ? rawProvider
    : 'disabled';
  const customServer = String(
    settings.find((item) => item.key === 'tweet.mediaUploadCustomServer')
      ?.value ?? '',
  );
  return {
    provider,
    customServer,
    server: providerServer(provider, customServer),
    noTransform: Boolean(
      settings.find((item) => item.key === 'tweet.mediaUploadNoTransform')
        ?.value ?? true,
    ),
  };
}
