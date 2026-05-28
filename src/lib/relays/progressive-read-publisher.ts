import {
  initialProgressiveRead,
  progressiveReadSnapshot,
  reduceProgressiveRead,
} from './progressive-read-reducer';
import type {
  OnProgressiveReadSnapshot,
  ProgressiveReadEvidence,
  ProgressiveReadSnapshot,
} from './progressive-read-types';

export function createProgressiveReadPublisher(input: {
  readonly readId: string;
  readonly surface?: string;
  readonly relays: readonly string[];
  readonly startedAt: number;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
}) {
  let state = initialProgressiveRead(input);
  const snapshot = (reason: string): ProgressiveReadSnapshot =>
    progressiveReadSnapshot(state, reason);
  const emit = (reason: string): void => {
    try {
      input.onSnapshot?.(snapshot(reason));
    } catch {
      // Snapshot listeners are observational and must not fail relay reads.
    }
  };
  return {
    emit,
    snapshot,
    apply: (evidence: ProgressiveReadEvidence, reason: string): void => {
      state = reduceProgressiveRead(state, evidence);
      emit(reason);
    },
  };
}
