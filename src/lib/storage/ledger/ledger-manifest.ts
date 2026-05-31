import type {
  CacheOwnerKind,
  CacheResourceKind,
} from '../../cache/cache-ledger-record';
import type { StorageTableName } from '../schema/table-spec';

export type LedgerResourceSpec = {
  readonly resourceKind: CacheResourceKind;
  readonly ownerKind: CacheOwnerKind;
  readonly owningTable: StorageTableName;
  readonly eventOwned: boolean;
};

export const ledgerResourceManifest = [
  resource('nostr-event', 'event', 'events', true),
  resource('notification-record', 'notification', 'notifications'),
  resource('feed-cursor', 'feed-page', 'feedCursors'),
  resource('coverage-row', 'feed-coverage', 'feedCoverage'),
  resource('scan-hint', 'feed-scan-hint', 'feedScanHints'),
  resource('tab-state', 'tab-snapshot', 'tabStates'),
  resource('relay-summary', 'relay-diagnostic', 'relayDiagnosticSummaries'),
  resource('relay-info', 'relay-information', 'relayInformation'),
  resource('relay-list-suggestion', 'relay-suggestion', 'relayListSuggestions'),
  resource('author-relay-route', 'route-evidence', 'authorRelayRoutes'),
  resource('job-record', 'job', 'jobs'),
] as const satisfies readonly LedgerResourceSpec[];

export const ledgerResourceKinds = ledgerResourceManifest.map(
  (entry) => entry.resourceKind,
) as readonly CacheResourceKind[];

export function ledgerResourceSpec(
  resourceKind: CacheResourceKind,
): LedgerResourceSpec {
  const spec = ledgerResourceManifest.find(
    (entry) => entry.resourceKind === resourceKind,
  );
  if (!spec) throw new Error(`Unhandled ledger resource kind: ${resourceKind}`);
  return spec;
}

export function directLedgerResourceSpecs(): readonly LedgerResourceSpec[] {
  return ledgerResourceManifest.filter((entry) => !entry.eventOwned);
}

function resource(
  resourceKind: CacheResourceKind,
  ownerKind: CacheOwnerKind,
  owningTable: StorageTableName,
  eventOwned = false,
): LedgerResourceSpec {
  return { resourceKind, ownerKind, owningTable, eventOwned };
}
