import { loadUploadSettings, type UploadSettings } from '../media/settings';

export async function loadTweetUploadSettings(): Promise<UploadSettings> {
  return loadUploadSettings();
}
