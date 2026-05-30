import { encodedJsonBytes } from '../cache/cache-byte-size';
import { cacheLedgerBytes } from '../cache/cache-ledger-bytes';
import { cacheLedgerId } from '../cache/cache-ledger-id';
import type { CacheLedgerRecord } from '../cache/cache-ledger-record';
import type { RelayDiagnosticSummary } from './relay-diagnostic-summary';
import type { RelayInformationRecord } from './relay-info-types';
import type { RelayListSuggestionRecord } from './relay-list-suggestions';
import type { RelayRoute } from './relay-route-types';

export function relaySummaryLedgerRecord(
  row: RelayDiagnosticSummary,
): CacheLedgerRecord {
  return withBytes(
    relayDraft(
      'relay-diagnostic',
      'relay-summary',
      row.relayUrl,
      row.updatedAt,
      80,
      row.relayUrl,
    ),
    row,
  );
}

export function relayInfoLedgerRecord(
  row: RelayInformationRecord,
): CacheLedgerRecord {
  return withBytes(
    relayDraft(
      'relay-information',
      'relay-info',
      row.relayUrl,
      row.fetchedAt,
      350,
      row.relayUrl,
    ),
    row,
  );
}

export function relaySuggestionLedgerRecord(
  row: RelayListSuggestionRecord,
): CacheLedgerRecord {
  return withBytes(
    relayDraft(
      'relay-suggestion',
      'relay-list-suggestion',
      row.id,
      row.updatedAt,
      300,
      row.relayUrl,
    ),
    row,
  );
}

export function relayRouteLedgerRecord(row: RelayRoute): CacheLedgerRecord {
  return withBytes(
    relayDraft(
      'route-evidence',
      'author-relay-route',
      row.id,
      row.updatedAt,
      300,
      row.relayUrl,
    ),
    row,
  );
}

function relayDraft(
  ownerKind: CacheLedgerRecord['ownerKind'],
  resourceKind: CacheLedgerRecord['resourceKind'],
  resourceId: string,
  updatedAt: number,
  baseScore: number,
  relayUrl: string,
): CacheLedgerRecord {
  return {
    id: cacheLedgerId(ownerKind, resourceId),
    ownerKind,
    resourceKind,
    resourceId,
    score: baseScore + Math.floor(updatedAt / 3_600_000),
    createdAt: updatedAt,
    updatedAt,
    cacheBytes: 0,
    protected: false,
    relayUrl,
    reason: 'recoverable-relay-cache',
  };
}

function withBytes(draft: CacheLedgerRecord, row: unknown): CacheLedgerRecord {
  return {
    ...draft,
    cacheBytes: encodedJsonBytes(row) + cacheLedgerBytes(draft),
  };
}
