import {
  eventProfileCanOpen,
  eventProfileOpenLabel,
} from './event-profile-activation';
import { eventRowCanOpenThread } from './event-row-activation';
import type { OpenProfileAction } from './action-availability';

type OpenThreadAction = ((eventId: string) => void) | undefined;

export type EventRowPresentationPlan = {
  readonly depthStyle: string;
  readonly profile: {
    readonly label: ReturnType<typeof eventProfileOpenLabel>;
    readonly openable: boolean;
  };
  readonly thread: {
    readonly openable: boolean;
  };
};

export function planEventRowPresentation(input: {
  readonly depth?: number;
  readonly openProfile: OpenProfileAction;
  readonly openThread: OpenThreadAction;
}): EventRowPresentationPlan {
  return {
    depthStyle: `--event-depth: ${input.depth ?? 0}`,
    profile: {
      label: eventProfileOpenLabel(),
      openable: eventProfileCanOpen(input.openProfile),
    },
    thread: {
      openable: eventRowCanOpenThread(input.openThread),
    },
  };
}
