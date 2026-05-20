import { uploadMediaFile, type UploadSettings } from '../media';
import type { TweetAttachment } from './draft-store';

export type { UploadSettings } from '../media';

export async function uploadTweetMedia(
  file: File,
  settings: UploadSettings,
): Promise<TweetAttachment> {
  const result = await uploadMediaFile(file, settings);
  return {
    url: result.url,
    name: file.name,
    type: file.type,
    tags: result.tags.map((tag) => [...tag]),
    imeta: [...result.imeta],
  };
}
