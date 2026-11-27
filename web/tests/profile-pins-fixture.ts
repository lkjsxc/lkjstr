import { createEngine } from '../src/engine/client.ts';
import type { FromEngine, NoteRow, ProfileRow, Row, ToEngine } from '../src/engine/protocol.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountFeed } from '../src/views/feed.ts';
import { note } from './public-snapshots-support.ts';
import { account, PUBKEY, vaultEnv } from './vault-ui-fixture.ts';

export const newer: NoteRow = { ...note('2'.repeat(64)), at: 20_000 };
export const older: NoteRow = { ...note('1'.repeat(64)), at: 10_000 };
export const pins = [older, newer].map((row) => ({ ...row, pinned: true }));

export function pinsFeed(cleanup: (() => void)[], version = 18, visible = true) {
  const f = vaultEnv();
  f.visible.set(visible);
  let receive!: (message: FromEngine) => void;
  const sent: ToEngine[] = [];
  const engine = createEngine({
    post: (message) => void sent.push(message),
    listen: (handler) => {
      receive = handler;
    },
    close() {},
  });
  receive({ t: 'ready', version, engine: 'fixture' });
  receive({ t: 'accounts', accounts: [account()], active: PUBKEY });
  saveViewState(f.env.instance, { pubkey: PUBKEY, show: 'posts' });
  const dispose = mountFeed(f.el, { ...f.env, engine }, 'profile');
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      dispose();
    }
  };
  cleanup.push(f.dispose, () => engine.dispose(), close);
  const sub = (source: string) => {
    const opened = sent.findLast((m) => m.t === 'open' && m.query.source === source);
    if (opened?.t !== 'open') throw new Error(`missing subscription: ${source}`);
    return opened.sub;
  };
  const profile: ProfileRow = {
    kind: 'profile',
    key: `profile:${PUBKEY}`,
    author: account().author,
    about: [],
    relays: [],
    partial: false,
    followed: false,
    followsYou: false,
    self: true,
    muted: false,
    followers: 1,
  };
  const rows = (source: string, values: Row[], atTop = true, atBottom = true) =>
    receive({ t: 'rows', sub: sub(source), rows: values, atTop, atBottom });
  rows('profile', [profile, newer, older]);
  return { ...f, sent, sub, rows, profile, receive, close };
}
