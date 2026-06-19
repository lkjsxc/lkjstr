import type { ScanDecisionTraceRecord } from './scan-model-records';

export type ScanHintStatus =
  | 'used'
  | 'expired'
  | 'rejected'
  | 'unavailable'
  | 'unknown';

export type ScanHintStatusRow = {
  readonly status: ScanHintStatus;
  readonly label: string;
  readonly count: number;
};

const statusLabels: readonly [ScanHintStatus, string][] = [
  ['used', 'Used'],
  ['expired', 'Expired'],
  ['rejected', 'Rejected'],
  ['unavailable', 'Unavailable'],
  ['unknown', 'Unknown'],
];

export function scanHintStatusRows(
  traces: readonly ScanDecisionTraceRecord[],
): ScanHintStatusRow[] {
  if (traces.length === 0) return [];
  const counts = statusLabels.reduce(
    (acc, [status]) => ({ ...acc, [status]: 0 }),
    {} as Record<ScanHintStatus, number>,
  );
  for (const trace of traces) counts[scanHintStatusForTrace(trace)] += 1;
  return statusLabels
    .map(([status, label]) => ({ status, label, count: counts[status] }))
    .filter((row) => row.status !== 'unknown' || row.count > 0);
}

export function scanHintStatusForTrace(
  trace: ScanDecisionTraceRecord,
): ScanHintStatus {
  return scanHintStatusFromRecord(record(trace.recordJson));
}

function scanHintStatusFromRecord(
  source: Record<string, unknown> | undefined,
): ScanHintStatus {
  const recordJson = child(source, 'recordJson');
  const bridge = child(source, 'bridge');
  const candidates = [
    source,
    recordJson,
    child(source, 'raw'),
    child(recordJson, 'raw'),
    child(bridge, 'raw'),
  ];
  for (const candidate of candidates) {
    const status =
      hintStatus(text(candidate, 'hint_status')) ??
      hintStatus(text(candidate, 'hintStatus'));
    if (status) return status;
  }
  return 'unknown';
}

function hintStatus(value: string | undefined): ScanHintStatus | undefined {
  switch (value?.toLowerCase()) {
    case 'used':
      return 'used';
    case 'expired':
      return 'expired';
    case 'rejected':
    case 'incompatible':
      return 'rejected';
    case 'unavailable':
      return 'unavailable';
    default:
      return undefined;
  }
}

function child(
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  return record(source?.[key]);
}

function text(
  source: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
