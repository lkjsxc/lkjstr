// What the mock does with the reader's actions, and what happens in its world on its own.

import { serverAddress } from '../../shared/address.ts';
import type { Action, Delivery, Failure, FromEngine, ToEngine, Uploaded } from '../protocol.ts';
import type { Core } from './engine.ts';
import { FILLER } from './fixtures-notes.ts';
import { byHandle, byPubkey, SELF } from './people.ts';
import { answers, isKnown, relayUrl } from './relays.ts';

/** How the mock's write relays answer a publish: two at once, one slowly, one with a refusal. */
const RELAYS: readonly (readonly [
  url: string,
  ms: number,
  state: Delivery['state'],
  message?: string,
])[] = [
  ['wss://relay.example.jp', 180, 'ok'],
  ['wss://nos.example.net', 420, 'ok'],
  ['wss://slow.example.org', 2400, 'ok'],
  ['wss://down.example.net', 900, 'failed', 'connection refused'],
];

export function createActions(core: Core) {
  const { world, post, later } = core;
  const done = (req: string, extra: Partial<Extract<FromEngine, { t: 'result' }>> = {}): void =>
    post({ t: 'result', req, ok: true, ...extra });
  const fail = (req: string, code: Failure['code'], message?: string): void =>
    post({ t: 'result', req, ok: false, error: { code, message } });

  /** Plays the per-relay answers of a publish, then the result. */
  const deliver = (req: string, extra: { id?: string } = {}, after?: () => void): void => {
    const relays: Delivery[] = RELAYS.map(([url]) => ({ url, state: 'pending' }));
    post({ t: 'delivery', req, relays: [...relays] });
    RELAYS.forEach(([url, ms, state, message], i) =>
      later(ms, () => {
        relays[i] = { url, state, message };
        post({ t: 'delivery', req, relays: [...relays] });
        if (i === 1) after?.(); // two relays have it: no longer pending
        if (relays.every((r) => r.state !== 'pending'))
          done(req, { delivery: [...relays], ...extra });
      }),
    );
  };

  async function upload(req: string, a: Extract<Action, { a: 'upload' }>): Promise<void> {
    const total = a.bytes.byteLength;
    if (total > 20 * 1024 * 1024)
      return fail(req, 'too-large', 'the server accepts files up to 20 MB');
    if (/fail/i.test(a.name)) {
      post({ t: 'progress', req, sent: Math.round(total * 0.4), total });
      return later(500, () => fail(req, 'rejected', 'media.example.jp: unsupported media type'));
    }
    const type = a.mime.startsWith('video')
      ? 'video'
      : a.mime.startsWith('audio')
        ? 'audio'
        : 'image';
    const blob = new Blob([a.bytes], { type: a.mime });
    const out: Uploaded = { url: URL.createObjectURL(blob), type, mime: a.mime };
    let size: { w?: number; h?: number } = {};
    try {
      const bmp = type === 'image' ? await createImageBitmap(blob) : undefined;
      if (bmp) size = { w: bmp.width, h: bmp.height };
    } catch {
      // not decodable here: the size stays unknown
    }
    for (let i = 1; i <= 5; i++)
      later(i * 220, () => {
        post({ t: 'progress', req, sent: Math.round((total * i) / 5), total });
        if (i === 5) done(req, { uploaded: { ...out, ...size } });
      });
  }

  function run(req: string, a: Action): void {
    const me = core.me();
    if (!a.a.startsWith('account.') && !me) return fail(req, 'signed-out');
    const signer = core.who.list().find((x) => x.author.pubkey === me)?.signer;
    if (!a.a.startsWith('account.') && a.a !== 'seen' && signer === 'none')
      return fail(req, 'read-only');
    switch (a.a) {
      case 'publish': {
        const w = a.what;
        const self = byPubkey(me) ?? SELF;
        if (w.k === 'note') {
          const text = w.draft.text.trim();
          if (/\bairdrop\b/i.test(text))
            return later(600, () => fail(req, 'rejected', 'blocked: spam filter'));
          const n = world.arrive(self, text, core.now(), {
            re: w.draft.replyTo,
            quote: w.draft.quote,
            cw: w.draft.cw,
            pending: true,
            client: core.clientTag ? 'lkjstr' : undefined,
            media: (w.draft.media ?? []).map((m) => ({
              type: m.type,
              url: m.url,
              w: m.w,
              h: m.h,
              alt: m.alt,
            })),
          });
          core.arrived(n);
          if (n.re) core.changed(n.re);
          return deliver(req, { id: n.id }, () => ((n.pending = false), core.changed(n.id)));
        }
        const n = world.byId.get(w.id);
        if (!n) return fail(req, 'not-found');
        if (w.k === 'repost') n.mineReposted = true;
        else if (w.k === 'reaction') {
          const r = n.reactions.get(w.emoji) ?? { count: 0, mine: false };
          if (!r.mine) n.reactions.set(w.emoji, { count: r.count + 1, mine: true });
        } else if (w.of === 'repost') n.mineReposted = false;
        else if (w.of === 'reaction') {
          for (const [emoji, r] of n.reactions) {
            if (!r.mine || (w.emoji && w.emoji !== emoji)) continue;
            if (r.count <= 1) n.reactions.delete(emoji);
            else n.reactions.set(emoji, { count: r.count - 1, mine: false });
          }
        } else {
          world.remove(n.id);
          core.resync();
          return deliver(req);
        }
        core.changed(n.id);
        return deliver(req);
      }
      case 'follow':
        if (a.on) world.state.following.add(a.pubkey);
        else world.state.following.delete(a.pubkey);
        core.resync(
          (q) => ['profile', 'followers', 'following', 'search'].includes(q.source),
          true,
        );
        return deliver(req);
      case 'mute': {
        const same = (m: (typeof world.state.mutes)[number]): boolean =>
          JSON.stringify(m) === JSON.stringify(a.target);
        world.state.mutes = world.state.mutes.filter((m) => !same(m));
        if (a.on) world.state.mutes.unshift(a.target);
        core.resync(undefined, a.target.k === 'person');
        return deliver(req);
      }
      case 'bookmark':
        if (a.on) world.state.bookmarks.add(a.id);
        else world.state.bookmarks.delete(a.id);
        core.changed(a.id);
        core.resync((q) => q.source === 'bookmarks');
        return deliver(req);
      case 'upload':
        return void upload(req, a);
      case 'relays.save': {
        const next = a.relays.map((r) => ({ ...r, url: relayUrl(r.url) ?? '' }));
        const bad = a.relays.find((r) => !relayUrl(r.url));
        if (bad) return fail(req, 'rejected', `not a relay address: ${bad.url}`);
        const seen = new Set<string>(); // bound: one save
        world.state.relays = next.filter(
          (r) => (r.read || r.write) && !seen.has(r.url) && Boolean(seen.add(r.url)),
        );
        const sync = (): void => {
          core.resync((q) => q.source === 'relays', true);
          core.status();
        };
        for (const r of world.state.relays) {
          if (world.state.met.has(r.url) || isKnown(r.url)) continue;
          later(900, () => {
            world.state.met.set(r.url, answers(r.url) ? 'connected' : 'failed');
            sync();
          });
        }
        sync();
        return deliver(req);
      }
      case 'servers.save': {
        const bad = a.servers.find((u) => serverAddress(u) !== u);
        if (bad) return fail(req, 'rejected', `not a server address: ${bad}`);
        world.state.servers = [...new Set(a.servers)];
        core.resync((q) => q.source === 'media-servers');
        return done(req);
      }
      case 'profile.save':
        return deliver(req);
      case 'seen':
        core.setUnread(0);
        core.accounts();
        return done(req);
      case 'account.use':
        return signedIn(req, core.who.use(a.pubkey));
      case 'account.remove':
        return signedIn(req, core.who.remove(a.pubkey));
      case 'account.add':
        // The extension lives on the main thread: the interface is asked for its key, as the real engine asks.
        if (a.how === 'extension') return void (asked.add(req), post({ t: 'getPublicKey', req }));
        return later(a.how === 'key' && a.key.startsWith('bunker') ? 700 : 120, () =>
          signedIn(req, core.who.add(a)),
        );
      case 'account.key': {
        const key = core.who.key(a.pubkey);
        return key ? done(req, { key }) : fail(req, 'unsupported');
      }
    }
  }
  const asked = new Set<string>(); // bound: `account.add` by extension still waiting for its key
  /** The end of anything that changes who is signed in: every list is the new reader's. */
  const signedIn = (req: string, error: Failure['code'] | null): void => {
    if (error) return fail(req, error);
    core.accounts();
    core.resync(undefined, true);
    done(req);
  };
  const publicKey = (m: Extract<ToEngine, { t: 'publicKey' }>): void => {
    if (!asked.delete(m.req)) return;
    if (!m.pubkey) return fail(m.req, m.error ?? 'signer-missing');
    signedIn(m.req, core.who.extension(m.pubkey));
  };

  let beat = 0;
  /** One beat of the mock world's own life: a note arrives, a count grows, a partial count settles. */
  function tick(): void {
    beat++;
    const recent = world.notes.slice(0, 30);
    const partial = recent.find((n) => n.partial);
    if (partial) (partial.partial = false), core.changed(partial.id);
    const liked = recent[(beat * 7) % recent.length];
    if (liked && beat % 2 === 0) {
      const r = liked.reactions.get('❤️') ?? { count: 0, mine: false };
      liked.reactions.set('❤️', { ...r, count: r.count + 1 });
      core.changed(liked.id);
    }
    if (beat % 3 !== 0) return;
    const [by, text] = FILLER[(beat * 5) % FILLER.length] ?? ['aoi', ''];
    core.arrived(world.arrive(byHandle(by), text, core.now(), { partial: true }));
  }

  return { run, tick, publicKey };
}
