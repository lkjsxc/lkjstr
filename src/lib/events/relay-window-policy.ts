import { boundarySince } from './relay-page-filter';
import {
  canSplitRelayPageSegment,
  relaySegmentMaxSpan,
  relaySegmentMinSpan,
  splitRelayPageSegment,
  type RelayPageSegment,
  type RelaySegmentRequest,
} from './relay-page-segments';

export type RelayWindowFeedback =
  | 'limit-hit'
  | 'under-half'
  | 'balanced'
  | 'incomplete';

export type RelayWindowFeedbackInput = {
  readonly complete: boolean;
  readonly hitLimit: boolean;
  readonly underHalfLimit: boolean;
};

export type AdaptiveRelayWindow =
  | {
      readonly kind: 'advance';
      readonly segment: RelayPageSegment;
    }
  | {
      readonly kind: 'split';
      readonly segments: readonly RelayPageSegment[];
    }
  | {
      readonly kind: 'terminal';
    };

export function classifyWindowFeedback(
  input: RelayWindowFeedbackInput,
): RelayWindowFeedback {
  if (!input.complete) return 'incomplete';
  if (input.hitLimit) return 'limit-hit';
  if (input.underHalfLimit) return 'under-half';
  return 'balanced';
}

export function nextAdaptiveRelayWindow(
  current: RelayPageSegment,
  request: RelaySegmentRequest,
  feedback: RelayWindowFeedback,
): AdaptiveRelayWindow {
  if (feedback === 'limit-hit') return splitOrTerminal(current, request);
  if (feedback === 'incomplete') {
    if (current.depth === 0) return splitOrTerminal(current, request);
    return { kind: 'terminal' };
  }
  const span =
    feedback === 'under-half'
      ? Math.min(relaySegmentMaxSpan, current.span * 2)
      : current.span;
  const segment = adjacentSegment(current, request, span);
  return segment ? { kind: 'advance', segment } : { kind: 'terminal' };
}

function splitOrTerminal(
  current: RelayPageSegment,
  request: RelaySegmentRequest,
): AdaptiveRelayWindow {
  if (!canSplitRelayPageSegment(current)) return { kind: 'terminal' };
  return {
    kind: 'split',
    segments: splitRelayPageSegment(current, request.direction),
  };
}

function adjacentSegment(
  current: RelayPageSegment,
  request: RelaySegmentRequest,
  requestedSpan: number,
): RelayPageSegment | undefined {
  const span = Math.max(relaySegmentMinSpan, requestedSpan);
  if (request.direction === 'newer') {
    const lower = request.after ? boundarySince(request.after)! : 0;
    if ((current.since ?? 0) <= lower) return undefined;
    const until = (current.since ?? 0) + 1;
    return segment(Math.max(lower, until - span), until);
  }
  const until = (current.since ?? 0) + 1;
  if (until <= 1) return undefined;
  return segment(Math.max(0, until - span), until);
}

function segment(since: number, until: number): RelayPageSegment {
  return {
    since,
    until,
    depth: 0,
    span: Math.max(relaySegmentMinSpan, until - since),
  };
}
