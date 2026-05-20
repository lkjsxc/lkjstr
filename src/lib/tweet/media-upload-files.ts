import type { TweetAttachment } from './draft-store';
import { uploadTweetMedia, type UploadSettings } from './media-upload';

export function acceptedTweetMedia(files: FileList | File[]): File[] {
  return Array.from(files).filter(
    (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
  );
}

export async function uploadTweetFiles(
  files: readonly File[],
  settings: UploadSettings,
): Promise<TweetAttachment[]> {
  const uploaded: TweetAttachment[] = [];
  for (const file of files)
    uploaded.push(await uploadTweetMedia(file, settings));
  return uploaded;
}
