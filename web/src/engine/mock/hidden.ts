import type { Query, SubState } from '../protocol.ts';

// Hidden notes in the mock (interface-hidden.md): which may be shown, the reader's own mute entry a word or hashtag
// matched, and which notes were shown although hidden (ids; bound: the fixture notes).
export const REVEALED = new Set<string>();
const NEVER = new Set(['deleted', 'expired']);
const DETAIL: Record<string, string> = { 'muted-word': 'spoiler', 'muted-hashtag': '#ネタバレ' };

export const hiddenOf = (id: string, reason: string | undefined) =>
  !reason
    ? {}
    : REVEALED.has(id) && !NEVER.has(reason)
      ? { revealed: { reason } }
      : {
          hidden: {
            reason,
            revealable: !NEVER.has(reason),
            ...(DETAIL[reason] && { detail: DETAIL[reason] }),
          },
        };

/** What never became a row (H4), reported for hashtag lists only: invalid deliveries counted exactly, a relay gap. */
export const unshownOf = (q: Query): Pick<SubState, 'unshown'> =>
  q.source === 'hashtag'
    ? {
        unshown: [
          { reason: 'invalid', count: 3, exact: true },
          { reason: 'undelivered', exact: false },
        ],
      }
    : {};
