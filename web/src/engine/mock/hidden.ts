import type { FromEngine, NoteRow, Query, Row, SubState } from '../protocol.ts';

// Hidden notes in the mock (interface-hidden.md): which may be shown, the reader's own mute entry a word or hashtag
// matched, and which notes were shown although hidden (ids; bound: the fixture notes).
const NEVER = new Set(['deleted', 'expired']);
const DETAIL: Record<string, string> = { 'muted-word': 'spoiler', 'muted-hashtag': '#ネタバレ' };

export const hiddenOf = (reason: string | undefined) =>
  !reason
    ? {}
    : {
        hidden: {
          reason,
          revealable: !NEVER.has(reason),
          ...(DETAIL[reason] && { detail: DETAIL[reason] }),
        },
      };

function project(row: NoteRow, revealed?: ReadonlySet<string>): NoteRow {
  if (!row.hidden) return row;
  if (row.hidden.revealable && revealed?.has(row.key)) {
    const { hidden, ...full } = row;
    return { ...full, revealed: { reason: hidden.reason } };
  }
  const { key, id, author, at, readingAt, hidden, thread } = row;
  return {
    kind: 'note',
    key,
    id,
    author: { pubkey: author.pubkey, npub: author.npub, name: author.pubkey, verified: false },
    at,
    ...(readingAt !== undefined && { readingAt }),
    hidden,
    thread,
    bech32: '',
    segments: [],
    media: [],
    quotes: [],
    reactions: [],
    counts: { replies: 0, reactions: 0, reposts: 0, zaps: 0, partial: false },
    mine: { reposted: false, bookmarked: false, own: false },
  };
}

export function projectHidden(message: FromEngine, revealed?: ReadonlySet<string>): FromEngine {
  const row = (value: Row): Row =>
    value.kind === 'note'
      ? project(value, revealed)
      : value.kind === 'notification' && value.note
        ? { ...value, note: project(value.note) }
        : value;
  if (message.t === 'rows') return { ...message, rows: message.rows.map(row) };
  if (message.t === 'patch')
    return {
      ...message,
      ops: message.ops.map((op) =>
        op.op === 'update'
          ? { ...op, row: row(op.row) }
          : op.op === 'insert'
            ? { ...op, rows: op.rows.map(row) }
            : op,
      ),
    };
  return message;
}

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

export function revealMockNote(
  sub: import('./subscription.ts').Sub | undefined,
  key: string,
  on: boolean,
): boolean {
  if (!sub?.windowed) return false;
  const row = sub.entries
    .slice(sub.start, sub.end)
    .find((entry) => entry.key === key)
    ?.row();
  if (row?.kind !== 'note' || !row.hidden?.revealable) return false;
  const revealed = (sub.revealed ??= new Set<string>());
  if (on && revealed.size >= 256 && !revealed.has(key)) return false;
  if (on) revealed.add(key);
  else revealed.delete(key);
  return true;
}
