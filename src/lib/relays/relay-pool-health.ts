import { createBoundedMap } from '../fp/bounded-map';
import { recordRelayDiagnosticSummary } from './relay-diagnostic-summary';
import { recordRelayHealthEvidence } from './relay-health';
import type { RelayConnectionState, RelaySnapshot } from './types';

type RelayHealthState = {
  readonly state: RelayConnectionState;
  readonly lastError?: string;
};

export function createRelayPoolHealthRecorder() {
  const states = createBoundedMap<string, RelayHealthState>({ maxSize: 100 });
  const openedOnce = createBoundedMap<string, true>({ maxSize: 100 });
  const record = (
    items: readonly RelaySnapshot[],
    onReopen: (url: string) => void,
  ): void => {
    for (const snapshot of items) recordSnapshot(snapshot, onReopen);
  };
  const recordSnapshot = (
    snapshot: RelaySnapshot,
    onReopen: (url: string) => void,
  ): void => {
    const previous = states.get(snapshot.url);
    const attempted =
      previous?.state !== 'connecting' && snapshot.state === 'connecting';
    const opened = previous?.state !== 'open' && snapshot.state === 'open';
    const errored = Boolean(
      snapshot.lastError &&
      (previous?.lastError !== snapshot.lastError ||
        (previous?.state !== 'error' && snapshot.state === 'error')),
    );
    if (attempted)
      void recordRelayHealthEvidence(snapshot.url, { attempted: true });
    if (opened) recordOpened(snapshot, onReopen);
    if (errored)
      void recordRelayHealthEvidence(snapshot.url, {
        failure: snapshot.state === 'error' ? snapshot.lastError : undefined,
        lastError: snapshot.lastError,
      });
    void recordRelayDiagnosticSummary(snapshot, { attempted, opened, errored });
    states.set(snapshot.url, {
      state: snapshot.state,
      lastError: snapshot.lastError,
    });
  };
  const recordOpened = (
    snapshot: RelaySnapshot,
    onReopen: (url: string) => void,
  ): void => {
    void recordRelayHealthEvidence(snapshot.url, { connectedAt: Date.now() });
    if (openedOnce.get(snapshot.url)) onReopen(snapshot.url);
    openedOnce.set(snapshot.url, true);
  };
  return {
    record,
  };
}
