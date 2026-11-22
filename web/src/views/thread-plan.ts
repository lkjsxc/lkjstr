// What a thread draws, from the engine's rows (docs/interface-thread.md): the notes above the focus, compact and
// joined by the rail, with the room of a note still being looked for wherever one answers a note not in view; the
// focus; the reply field; the replies grouped under the note they answer, one step in at most, long branches folded.
// The engine's order is kept among siblings; paging still follows it. Pure, tested.
import type { Author, NoteRow, Row } from '../engine/protocol.ts';

/** How a thread note is drawn; the engine's own fields are left as they came. */
export type ThreadLook = {
  /** A note above, folded to two lines. */
  readonly compact?: boolean;
  /** The rail comes from the row above into its face. */
  readonly above?: boolean;
  /** A line leaves its face downwards: the rail to the next note, or its branch. */
  readonly below?: boolean;
  /** One step in: further down a branch. */
  readonly step?: boolean;
  /** The last row of its branch: its elbow ends the line. */
  readonly last?: boolean;
  /** It answers someone other than its branch's first note. */
  readonly to?: Author;
};
export type ThreadNote = NoteRow & { readonly look: ThreadLook };
export type ThreadPart = { readonly kind: 'thread-part'; readonly key: string } & (
  | { readonly part: 'slot'; readonly state: 'loading' | 'missing'; readonly first: boolean }
  | { readonly part: 'earlier'; readonly n: number }
  | { readonly part: 'more'; readonly n: number; readonly head: string }
  | { readonly part: 'say' }
  | { readonly part: 'skeleton'; readonly of: 'focus' | 'reply' }
);
export type Drawn = Row | ThreadNote | ThreadPart;

/** What the reader opened in this tab. */
export type ThreadUi = {
  readonly open?: readonly string[];
  readonly earlier?: boolean;
  readonly branches?: readonly string[];
};

const EARLIER_FROM = 4;
const BRANCH_FROM = 4;
const BRANCH_SHOWN = 2;

type Unkinded<T> = T extends unknown ? Omit<T, 'kind'> : never;
const part = (p: Unkinded<ThreadPart>): ThreadPart => ({ kind: 'thread-part', ...p }) as ThreadPart;
const parentOf = (n: NoteRow): string | undefined => n.thread?.parent ?? n.replyTo?.id;
const look = (n: NoteRow, l: ThreadLook): ThreadNote => ({ ...n, look: l });

export function planThread(
  rows: readonly Row[],
  ui: ThreadUi,
  o: {
    /** Relays are still being asked for the first time. */
    readonly asking: boolean;
    /** Whether a note not in view is still being looked for, or given up. */
    readonly wait: (id: string) => 'loading' | 'missing';
  },
): Drawn[] {
  const notes = rows.filter((r): r is NoteRow => r.kind === 'note');
  const focus = notes.find((n) => n.thread?.role === 'focus');
  if (!focus)
    return o.asking && !rows.length
      ? [part({ key: 'th:wait', part: 'skeleton', of: 'focus' })]
      : [...rows];
  const chain = notes.filter((n) => n.thread?.role !== 'reply');
  const above: Drawn[] = [];
  chain.forEach((n, i) => {
    const up = parentOf(n);
    if (up && chain[i - 1]?.id !== up)
      above.push(part({ key: `th:slot:${up}`, part: 'slot', state: o.wait(up), first: i === 0 }));
    const own = n === focus;
    const shown = above.length > 0;
    above.push(
      look(
        n,
        own ? { above: shown } : { above: shown, below: true, compact: !ui.open?.includes(n.id) },
      ),
    );
  });
  const ancestors = chain.length - 1;
  if (ancestors >= EARLIER_FROM && !ui.earlier) {
    const first = above.findIndex((d) => d.key === chain[0]?.key);
    const last = above.findIndex((d) => d.key === chain[ancestors - 1]?.key);
    above.splice(
      first + 1,
      last - first - 1,
      part({ key: 'th:earlier', part: 'earlier', n: ancestors - 2 }),
    );
  }
  const replies = notes.filter((n) => n.thread?.role === 'reply');
  const out: Drawn[] = [...above];
  if (focus.eventKind === undefined || focus.eventKind === 30023)
    out.push(part({ key: 'th:say', part: 'say' }));
  if (!replies.length && o.asking) {
    out.push(part({ key: 'th:wait:1', part: 'skeleton', of: 'reply' }));
    out.push(part({ key: 'th:wait:2', part: 'skeleton', of: 'reply' }));
  }
  const byId = new Map(replies.map((n) => [n.id, n]));
  const under = new Map<string, NoteRow[]>(); // bound: the replies of this window
  const heads: NoteRow[] = [];
  for (const n of replies) {
    const up = parentOf(n);
    if (up && up !== focus.id && byId.has(up)) under.set(up, [...(under.get(up) ?? []), n]);
    else heads.push(n);
  }
  for (const head of heads) {
    const branch: NoteRow[] = [];
    const walk = (id: string): void => {
      for (const n of under.get(id) ?? []) branch.push(n), walk(n.id);
    };
    walk(head.id);
    const folded = branch.length >= BRANCH_FROM && !ui.branches?.includes(head.id);
    const shown = folded ? branch.slice(0, BRANCH_SHOWN) : branch;
    const away = parentOf(head);
    const to = away && away !== focus.id ? head.replyTo?.author : undefined;
    out.push(look(head, { below: shown.length > 0, ...(to ? { to } : {}) }));
    shown.forEach((n, i) => {
      const up = parentOf(n);
      const author = up && up !== head.id ? byId.get(up)?.author : undefined;
      const end = i === shown.length - 1 && !folded;
      out.push(
        look(n, { step: true, ...(end ? { last: true } : {}), ...(author ? { to: author } : {}) }),
      );
    });
    if (folded)
      out.push(
        part({
          key: `th:more:${head.id}`,
          part: 'more',
          n: branch.length - BRANCH_SHOWN,
          head: head.id,
        }),
      );
  }
  return out;
}
