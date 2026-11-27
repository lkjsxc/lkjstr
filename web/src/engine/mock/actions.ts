// What the mock does with the reader's actions, and what happens in its world on its own.

import { serverAddress } from '../../shared/address.ts';
import type { Action, Draft, Failure, FromEngine, ToEngine } from '../protocol.ts';
import { channelAct, channelTouched, chatter } from './channels.ts';
import { HANDLERS } from './client-handlers.ts';
import type { Core } from './engine.ts';
import { FILLER } from './fixtures-notes.ts';
import { revealMockNote } from './hidden.ts';
import { createMockNoteOutbox } from './note-outbox.ts';
import {
  byHandle,
  byPubkey,
  byRef,
  isMockProfileRef,
  type Person,
  SELF,
  saveProfile,
} from './people.ts';
import { retryLists } from './private-lists.ts';
import { createDelivery } from './publication.ts';
import { addReaction, removeReaction } from './reactions.ts';
import { answers, isKnown, relayUrl } from './relays.ts';
import { createUploads } from './uploads.ts';
import { vaultAct } from './vault.ts';

export function createActions(core: Core) {
  const { world, post, later } = core;
  const done = (req: string, extra: Partial<Extract<FromEngine, { t: 'result' }>> = {}): void =>
    post({ t: 'result', req, ok: true, ...extra });
  const fail = (req: string, code: Failure['code'], message?: string): void =>
    post({ t: 'result', req, ok: false, error: { code, message } });
  const deliver = createDelivery(core);
  const notes = createMockNoteOutbox(core);
  const uploads = createUploads(core);
  /** Signs a note (it arrives, pending, in the reader's lists) and sends it. */
  function sign(
    req: string,
    w: Extract<Extract<Action, { a: 'publish' }>['what'], { k: 'note' }>,
    text: string,
    self: Person,
    late = 0,
  ): void {
    const n = world.arrive(self, text, core.now(), {
      re: w.draft.replyTo,
      channel: w.draft.channel ?? world.byId.get(w.draft.replyTo ?? '')?.channel,
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
    const key = !n.channel ? w.noteKey : undefined;
    if (key) notes.set({ key, id: n.id, phase: 'sending', attempts: 1, delivery: [] });
    if (!n.channel) post({ t: 'publish.signed', req, id: n.id });
    core.arrived(n);
    if (n.re) core.changed(n.re);
    if (n.channel) channelTouched(core, n.channel);
    const outcome = /\bunanswered\b/i.test(text)
      ? 'unanswered'
      : text.includes('all relays refuse')
        ? 'refused'
        : 'normal';
    deliver(
      req,
      { id: n.id },
      (relays) => {
        if (!notes.finish(key, n.id, outcome, relays)) return;
        n.pending = !!key && outcome === 'unanswered';
        if (outcome !== 'normal' && !n.channel && !n.pending) n.unconfirmed = true;
        core.changed(n.id);
      },
      late,
      outcome,
    );
  }
  function run(req: string, a: Action): void {
    if (a.a === 'link.check') {
      // Mock screenshots and smoke use fixture handles and synthetic note references.
      const found =
        a.route === 'p'
          ? byRef(a.ref) || isMockProfileRef(a.ref)
          : a.route === 'n' && /^note1[0-9a-f]{58}$/.test(a.ref);
      return found ? done(req) : fail(req, 'rejected');
    }
    if (a.a === 'client.info') {
      const info = Object.values(HANDLERS).find((x) => x.address === a.address)?.info;
      return info ? done(req, { clientInfo: info }) : fail(req, 'not-found');
    }
    if (a.a === 'note.reveal') {
      if (!revealMockNote(core.subs.get(a.sub), a.key, a.reveal)) return fail(req, 'not-found');
      return (core.changed(a.key), done(req));
    }
    if (a.a === 'lists.retry') return retryLists(core, req, a.as);
    const me = core.me();
    if (!a.a.startsWith('account.') && !me) return fail(req, 'signed-out');
    const account = core.who.list().find((x) => x.author.pubkey === me);
    const signer = account?.signer;
    if (!a.a.startsWith('account.') && a.a !== 'seen' && account?.locked)
      return fail(req, 'signer-missing');
    if (!a.a.startsWith('account.') && a.a !== 'seen' && signer === 'none')
      return fail(req, 'read-only');
    switch (a.a) {
      case 'publish': {
        const w = a.what;
        const self = byPubkey(me) ?? SELF;
        if (w.k === 'note') {
          const text = expandMentions(w.draft).trim();
          if (/\bairdrop\b/i.test(text))
            return later(600, () => fail(req, 'rejected', 'blocked: spam filter'));
          const slow = core.slow && text.includes(core.slow.when) ? core.slow : undefined;
          if (slow?.sign) return later(slow.sign, () => sign(req, w, text, self, slow.relays));
          return sign(req, w, text, self, slow?.relays);
        }
        const n = world.byId.get(w.id);
        if (!n) return fail(req, 'not-found');
        if (w.k === 'repost') n.mineReposted = true;
        else if (w.k === 'reaction') addReaction(n.reactions, w);
        else if (w.of === 'repost') n.mineReposted = false;
        else if (w.of === 'reaction') removeReaction(n.reactions, w);
        else {
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
          (q) =>
            [
              'home',
              'their-home',
              'people',
              'profile',
              'followers',
              'following',
              'search',
            ].includes(q.source),
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
        return uploads.run(req, a);
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
      case 'servers.check':
        return done(req);
      case 'servers.save': {
        const bad = a.servers.find((u) => serverAddress(u) !== u);
        if (bad) return fail(req, 'rejected', `not a server address: ${bad}`);
        world.state.servers = [...new Set(a.servers)];
        core.resync((q) => q.source === 'media-servers');
        return done(req);
      }
      case 'profile.save': {
        if (/\bairdrop\b/i.test(a.profile.about))
          return later(400, () => fail(req, 'rejected', 'blocked: spam filter'));
        saveProfile(byPubkey(me) ?? SELF, a.profile);
        core.accounts();
        core.resync(undefined, true);
        return deliver(req);
      }
      case 'channel.join':
      case 'channel.save':
      case 'channel.seen':
        return channelAct(core, a, {
          done: (x) => done(req, x),
          fail: (code, message) => fail(req, code, message),
          deliver: (x) => deliver(req, x),
        });
      case 'seen':
        world.state.notificationSeen = core.now();
        core.resync((q) => q.source === 'notifications', true);
        core.setUnread(0);
        core.accounts();
        return done(req);
      case 'account.importEncrypted':
      case 'account.unlock':
      case 'account.lock':
      case 'account.exportEncrypted':
        return vaultAct(
          core,
          a,
          (extra) => done(req, extra),
          (code) => fail(req, code),
        );
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
        if (core.who.list().find((x) => x.author.pubkey === a.pubkey)?.locked)
          return fail(req, 'signer-missing');
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
  /** One beat of the mock world's own life: a note arrives and a count grows. */
  function tick(): void {
    beat++;
    const recent = world.notes.slice(0, 30);
    const liked = recent[(beat * 7) % recent.length];
    if (liked && beat % 2 === 0) {
      const r = liked.reactions.get('❤️') ?? { count: 0, mine: false };
      liked.reactions.set('❤️', { ...r, count: r.count + 1 });
      core.changed(liked.id);
    }
    if (beat % 4 === 2) chatter(core, beat);
    if (beat % 3 !== 0) return;
    const [by, text] = FILLER[(beat * 5) % FILLER.length] ?? ['aoi', ''];
    const own = world.notes.find((n) => n.by.author.pubkey === core.me() && !n.channel);
    core.arrived(world.arrive(byHandle(by), text, core.now(), { partial: false, re: own?.id }));
    core.resync((q) => q.source === 'notifications', true);
  }

  return { run, tick, publicKey, cancelUpload: uploads.cancel, dispose: uploads.dispose, notes };
}

function expandMentions(draft: Draft): string {
  let text = draft.text;
  for (const mention of [...(draft.mentions ?? [])].sort((a, b) => b.start - a.start)) {
    const author = byPubkey(mention.pubkey)?.author;
    if (author && text.slice(mention.start, mention.end) === mention.label)
      text = `${text.slice(0, mention.start)}nostr:${author.npub}${text.slice(mention.end)}`;
  }
  return text;
}
