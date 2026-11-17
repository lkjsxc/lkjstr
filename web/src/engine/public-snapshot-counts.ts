// Only a committed contributor basis may supply durable public count models.
import type { Counts, NoteRow, Reaction, Row } from './protocol.ts';

type Held = { counts: Counts; reactions: readonly Reaction[] };
export type DurableCounts = Map<string, Held>;
const MAX = 128; // Two 64-row public snapshots per subscription.

function evidence(value: Counts): NonNullable<Counts['context']> | undefined {
  const next = value.context;
  if (
    !next ||
    !/^(0|[1-9][0-9]{0,19})$/.test(next.generation) ||
    BigInt(next.generation) > 18446744073709551615n ||
    !next.lineage ||
    next.lineage.length > 128 ||
    !next.token ||
    next.token.length > 128
  )
    return;
  return next;
}

type Selection = NonNullable<NonNullable<Counts['context']>['selection']>;
function selection(value: Counts): Selection | undefined {
  const basis = value.context?.selection;
  if (!basis || !/^[0-9a-f]{64}$/.test(basis.account) || !basis.token || basis.token.length > 128)
    return;
  if (basis.id === undefined) return basis.createdAt === undefined ? basis : undefined;
  if (
    !/^[0-9a-f]{64}$/.test(basis.id) ||
    !/^(0|[1-9][0-9]{0,19})$/.test(basis.createdAt ?? '') ||
    BigInt(basis.createdAt!) > 18446744073709551615n
  )
    return;
  return basis;
}
/** Keep one coherent count model when its view policy is older or still uncommitted. */
function selectionAllows(old: Counts, next: Counts): boolean {
  if (!old.context?.selection && !next.context?.selection) return true;
  const held = selection(old),
    incoming = selection(next);
  if (!held || !incoming?.committed || held.account !== incoming.account) return false;
  if (held.id === incoming.id && held.createdAt === incoming.createdAt)
    return held.token === incoming.token || old.context?.token !== next.context?.token;
  if (!next.context?.current || !incoming.id) return false;
  if (!held.id) return true;
  const a = BigInt(held.createdAt!),
    b = BigInt(incoming.createdAt!);
  return b > a || (b === a && incoming.id < held.id);
}

export function mergePublicCounts(old: NoteRow, next: NoteRow): Held {
  const held = evidence(old.counts);
  const incoming = evidence(next.counts);
  if (
    !held ||
    (incoming?.restored &&
      selectionAllows(old.counts, next.counts) &&
      incoming.lineage === held.lineage &&
      (BigInt(incoming.generation) > BigInt(held.generation) ||
        (incoming.generation === held.generation && incoming.token === held.token)))
  )
    return { counts: next.counts, reactions: next.reactions };
  return { counts: old.counts, reactions: old.reactions };
}

export function rememberPublicCounts(rows: readonly Row[], values: DurableCounts): void {
  for (const row of rows) {
    if (row.kind === 'notification') {
      if (row.note) rememberPublicCounts([row.note], values);
      continue;
    }
    if (row.kind !== 'note') continue;
    const basis = evidence(row.counts);
    if (!basis?.restored || !basis.current) continue;
    const held = values.get(row.id);
    const previous = held && evidence(held.counts);
    if (
      previous &&
      (!selectionAllows(held!.counts, row.counts) ||
        previous.lineage !== basis.lineage ||
        BigInt(basis.generation) < BigInt(previous.generation) ||
        (basis.generation === previous.generation && basis.token !== previous.token))
    )
      continue;
    values.delete(row.id);
    values.set(row.id, { counts: row.counts, reactions: row.reactions });
    if (values.size > MAX) values.delete(values.keys().next().value ?? '');
  }
}

export function durablePublicRows(rows: readonly Row[], values: DurableCounts): readonly Row[] {
  return rows.map((row): Row => {
    if (row.kind === 'notification')
      return row.note ? { ...row, note: durablePublicRows([row.note], values)[0] as NoteRow } : row;
    if (row.kind !== 'note') return row;
    const basis = evidence(row.counts);
    if (basis?.restored && basis.current) return row;
    const held = values.get(row.id);
    if (held) return { ...row, ...held };
    // Existing unknown/lower-bound presentation, never an invented confirmed zero.
    return {
      ...row,
      counts: { replies: 0, reposts: 0, reactions: 0, zaps: 0, partial: true, zapState: 'loading' },
      reactions: [],
    };
  });
}
