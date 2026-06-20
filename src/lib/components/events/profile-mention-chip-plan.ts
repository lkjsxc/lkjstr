import type { ProfileSummary } from '$lib/identity/identity';
import type { CustomEmoji } from '$lib/protocol';
import type { OpenProfileAction } from './action-availability';
import { eventProfileCanOpen } from './event-profile-activation';

export type ProfileMentionChipPlan = {
  readonly canOpenProfile: boolean;
  readonly title: string;
  readonly text: string;
  readonly emojis: readonly CustomEmoji[];
};

export function planProfileMentionChip(input: {
  readonly text: string;
  readonly rawText: string;
  readonly profile?: ProfileSummary;
  readonly openProfile: OpenProfileAction;
}): ProfileMentionChipPlan {
  return {
    canOpenProfile: eventProfileCanOpen(input.openProfile),
    title: input.rawText,
    text: input.text,
    emojis: input.profile?.customEmojis ?? [],
  };
}
