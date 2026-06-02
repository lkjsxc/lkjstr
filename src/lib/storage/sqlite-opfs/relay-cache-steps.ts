import type { RelayDiagnosticSummary } from '../../relays/relay-diagnostic-summary';
import type { RelayInformationRecord } from '../../relays/relay-info-types';
import type { RelayListSuggestionRecord } from '../../relays/relay-list-suggestions';
import type {
  RelayRoute,
  RelayRouteBlock,
} from '../../relays/relay-route-types';
import { jsonRecordStep } from './sqlite-record-helpers';
import type { SqlStep } from './types';

export function summaryStep(row: RelayDiagnosticSummary): SqlStep {
  return jsonRecordStep(
    'relay_diagnostic_summaries',
    'relay_url',
    row.relayUrl,
    row,
    row.updatedAt,
  );
}

export function informationStep(row: RelayInformationRecord): SqlStep {
  return {
    statement:
      'INSERT INTO relay_information (relay_url, status, record_json, fetched_at_ms) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(relay_url) DO UPDATE SET status = excluded.status, record_json = excluded.record_json, fetched_at_ms = excluded.fetched_at_ms;',
    params: [row.relayUrl, row.status, JSON.stringify(row), row.fetchedAt],
  };
}

export function suggestionStep(row: RelayListSuggestionRecord): SqlStep {
  return {
    statement:
      'INSERT INTO relay_list_suggestions (id, account_pubkey, relay_url, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET account_pubkey = excluded.account_pubkey, relay_url = excluded.relay_url, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.accountPubkey,
      row.relayUrl,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

export function routeStep(row: RelayRoute): SqlStep {
  return {
    statement:
      'INSERT INTO author_relay_routes (id, author_pubkey, relay_url, source, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET relay_url = excluded.relay_url, source = excluded.source, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.authorPubkey,
      row.relayUrl,
      row.source,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

export function routeBlockStep(row: RelayRouteBlock): SqlStep {
  return {
    statement:
      'INSERT INTO relay_route_blocks (relay_url, purpose, reason, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(relay_url) DO UPDATE SET purpose = excluded.purpose, reason = excluded.reason, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.relayUrl,
      row.purpose,
      row.reason,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}
