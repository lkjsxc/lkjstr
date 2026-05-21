import type { NostrEvent, NostrTag } from './event';

export function contentWarningReason(event: NostrEvent): string | null {
  const tag = event.tags.find((item) => item[0] === 'content-warning');
  if (!tag) return null;
  return tag[1]?.trim() || '';
}

export function hasContentWarning(event: NostrEvent): boolean {
  return contentWarningReason(event) !== null;
}

export function contentWarningTag(reason = ''): NostrTag {
  const trimmed = reason.trim();
  return trimmed ? ['content-warning', trimmed] : ['content-warning'];
}
