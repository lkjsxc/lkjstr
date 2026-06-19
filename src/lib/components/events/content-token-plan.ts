import type { ContentToken } from '$lib/events/content-tokens';
import { bestDisplayName } from '$lib/identity/display-name';
import type { ProfileSummary } from '$lib/identity/identity';

type ContentTokenLinkEvent = {
  stopPropagation(): void;
};

export function contentTokenRenderKey(
  token: ContentToken,
  index: number,
): string {
  return `${index}:${token.type}`;
}

export function contentTokenProfileLabel(
  pubkey: string,
  rawText: string,
  profiles: Readonly<Record<string, ProfileSummary>> | undefined,
): string {
  const profile = profiles?.[pubkey];
  return profile ? `@${bestDisplayName(profile)}` : rawText;
}

export function contentTokenEventVisible(
  eventId: string,
  hiddenEventIds: ReadonlySet<string> | undefined,
): boolean {
  return !hiddenEventIds?.has(eventId);
}

export function contentTokenUrlLinkPlan(url: string): {
  readonly href: string;
  readonly target: string;
  readonly rel: string;
} {
  return {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
  };
}

export function stopContentTokenLinkPropagation(
  event: ContentTokenLinkEvent,
): void {
  event.stopPropagation();
}
