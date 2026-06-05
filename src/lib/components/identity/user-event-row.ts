import { encodeNpub } from '$lib/protocol/nip19';
import type { ProfileSummary } from '$lib/identity/identity';
import { feedIdentityDisplay } from '$lib/identity/feed-identity';

export type UserEventRowContext = {
  readonly petname?: string;
  readonly relayUrl?: string;
  readonly sourceRelay?: string;
};

export type UserEventRowView = {
  readonly title: string;
  readonly subtitle: string;
  readonly avatarUrl: string | null;
  readonly stale: boolean;
  readonly verifiedNip05: boolean;
  readonly chips: readonly string[];
  readonly npub: string;
};

export function userEventRowView(input: {
  readonly pubkey: string;
  readonly profile?: ProfileSummary;
  readonly context?: UserEventRowContext;
}): UserEventRowView {
  const display = feedIdentityDisplay(input.pubkey, input.profile);
  return {
    title: display.title,
    subtitle: display.subtitle,
    avatarUrl: display.avatarUrl,
    stale: display.stale,
    verifiedNip05: display.verifiedNip05,
    chips: contextChips(input.context, display.stale),
    npub: safeNpub(input.pubkey),
  };
}

export function safeNpub(pubkey: string): string {
  try {
    return encodeNpub(pubkey);
  } catch {
    return pubkey;
  }
}

function contextChips(
  context: UserEventRowContext | undefined,
  stale: boolean,
): string[] {
  return [
    context?.petname ? `petname ${context.petname}` : '',
    context?.relayUrl ? `hint ${context.relayUrl}` : '',
    context?.sourceRelay ? `source ${context.sourceRelay}` : '',
    stale ? 'stale metadata' : '',
  ].filter(Boolean);
}
