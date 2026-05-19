import type { NostrEvent } from '../protocol';

export type ContentAttachment = {
  readonly url: string;
  readonly type: 'image' | 'video' | 'audio' | 'link';
};

const urlPattern = /\bhttps:\/\/[^\s<>"']+/gi;

export function contentAttachments(event: NostrEvent): ContentAttachment[] {
  return dedupe([
    ...imetaAttachments(event),
    ...contentUrls(event.content).map((url) => classifyUrl(url)),
  ]);
}

export function contentUrls(content: string): string[] {
  return [...content.matchAll(urlPattern)]
    .map((match) => cleanUrl(match[0] ?? ''))
    .filter((url) => url.length > 0);
}

export function classifyUrl(url: string): ContentAttachment {
  const lower = cleanUrl(url).toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif)(\?|#|$)/.test(lower))
    return { url: cleanUrl(url), type: 'image' };
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(lower))
    return { url: cleanUrl(url), type: 'video' };
  if (/\.(mp3|m4a|ogg|opus|wav|flac)(\?|#|$)/.test(lower))
    return { url: cleanUrl(url), type: 'audio' };
  return { url: cleanUrl(url), type: 'link' };
}

function imetaAttachments(event: NostrEvent): ContentAttachment[] {
  return event.tags
    .filter((tag) => tag[0] === 'imeta')
    .flatMap((tag) => {
      const url = tagToken(tag, 'url');
      if (!url?.startsWith('https://')) return [];
      const mime = tagToken(tag, 'm')?.toLowerCase() ?? '';
      if (mime.startsWith('image/')) return [{ url, type: 'image' } as const];
      if (mime.startsWith('video/')) return [{ url, type: 'video' } as const];
      if (mime.startsWith('audio/')) return [{ url, type: 'audio' } as const];
      return [classifyUrl(url)];
    });
}

function tagToken(tag: readonly string[], name: string): string | undefined {
  const prefix = `${name} `;
  return tag.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

function cleanUrl(url: string): string {
  return url.replace(/[),.;:!?]+$/u, '');
}

function dedupe(items: readonly ContentAttachment[]): ContentAttachment[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url.startsWith('https://') || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
