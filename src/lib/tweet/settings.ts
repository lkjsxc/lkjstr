import { loadSettings } from '../settings/settings-store';
import type { UploadSettings } from './media-upload';

export async function loadTweetUploadSettings(): Promise<UploadSettings> {
  const settings = await loadSettings();
  return {
    server: String(
      settings.find((item) => item.key === 'tweet.mediaUploadServer')?.value ??
        '',
    ),
    noTransform: Boolean(
      settings.find((item) => item.key === 'tweet.mediaUploadNoTransform')
        ?.value ?? true,
    ),
  };
}
