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
  const uploaded = new Array<TweetAttachment>(files.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      const file = files[index];
      if (!file) return;
      try {
        uploaded[index] = await uploadTweetMedia(file, settings);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Media upload failed.';
        throw new Error(`${file.name}: ${message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, files.length) }, worker));
  return uploaded;
}
