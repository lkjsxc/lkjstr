// What a face lease carries, and the one check that admits a Worker-made still.
import type { AvatarOutput } from './protocol.ts';

export type AvatarValue =
  | { readonly kind: 'pending' | 'rejected' }
  | { readonly kind: 'ready'; readonly url: string }
  | { readonly kind: 'fallback'; readonly uniform: boolean };
export type Receive = (value: AvatarValue) => void;
/** Calling it releases the lease. `rank` moves the face: 0 on screen, 1 next to it, 2 further along the feed. */
export type AvatarLease = (() => void) & { rank(rank: number): void };
export type Entry = {
  url: string;
  epoch: number;
  observePublic: boolean;
  owners: Map<number, { receive: Receive; rank: number }>;
  value: AvatarValue;
  req?: string;
  sent?: number;
  retry?: number;
  objectUrl?: string;
  bytes: number;
  /** Keeps the decoded picture available, so a new row's image is complete in the frame it is drawn. */
  holder?: HTMLImageElement;
  until?: number;
};
export const MAX_URLS = 1024; // Settled pictures of this session, owned or not.
export const MAX_PENDING = 256; // The Worker's wanted-URL bound for one client.
export const MAX_BYTES = 32 * 1024 * 1024; // Ready Blobs; each is at most 128 KiB.
export const NEGATIVE_MS = 120_000; // An unowned fallback or refusal is asked again after this.
/** A URL is asked for from the best place any of its faces holds. */
export const rankOf = (entry: Entry): number => {
  let rank = 2;
  for (const owner of entry.owners.values()) rank = Math.min(rank, owner.rank);
  return rank;
};
export const readyBlob = (message: AvatarOutput): Blob | undefined => {
  const { blob, image } = message;
  if (
    !(blob instanceof Blob) ||
    !image ||
    blob.size < 1 ||
    blob.size > 131072 ||
    image.bytes !== blob.size ||
    image.mime !== blob.type ||
    !['image/webp', 'image/jpeg', 'image/png'].includes(blob.type) ||
    !Number.isInteger(image.edge) ||
    image.edge < 1 ||
    image.edge > 160 ||
    !Number.isInteger(image.sourceWidth) ||
    !Number.isInteger(image.sourceHeight) ||
    image.sourceWidth < image.edge ||
    image.sourceHeight < image.edge
  )
    return;
  return blob;
};
