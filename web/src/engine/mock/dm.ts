// The test double's private stream is separate from its public note world.

import type { DmMessage, DmQuery, ToEngine } from '../protocol.ts';
import { createMockPrivateDrafts } from './dm-drafts.ts';
import { createMockDmEditors } from './dm-editors.ts';
import { privateSnapshot } from './dm-view.ts';
import type { Core } from './engine.ts';
import type { createMockSignerFixtures } from './signer-fixtures.ts';
export function createPrivateMock(
  core: Core,
  signer?: ReturnType<typeof createMockSignerFixtures>,
) {
  let serial = 0;
  const drafts = createMockPrivateDrafts(core);
  const editors = createMockDmEditors(core, () => refresh());
  const subscriptions = new Map<string, DmQuery>(); // <=32 private views
  const messages: DmMessage[] = []; // <=2000 mock messages
  const seen = new Set<string>(); // <=2000 messages x32 participants
  const inboxes = new Map<string, readonly string[]>(); // <=32 saved mock accounts
  const hidden = new Set<string>(); // <=32 private views
  let accountRefresh = false;
  let pageHidden = false;
  const rooms = new Map<string, string>(); // <=2000 retained conversations
  const room = (peers: readonly string[]) => {
    const signature = [...peers].sort().join(':');
    let key = rooms.get(signature);
    if (!key) {
      key = (++serial).toString(16).padStart(64, '0');
      rooms.set(signature, key);
    }
    return key;
  };
  const access = (query: DmQuery): string | undefined => {
    const account = core.who.list().find((a) => a.author.pubkey === query.account);
    if (!account) return 'signed-out';
    if (account.signer === 'none') return 'read-only';
    if (account.locked) return 'signer-missing';
    if (
      [query.account, query.conversation, query.before].some(
        (v) => v !== undefined && !/^[0-9a-f]{64}$/.test(v),
      )
    )
      return 'rejected';
    return undefined;
  };
  const emit = (sub: string, query: DmQuery, forced?: string): void => {
    if (!forced && (pageHidden || hidden.has(sub))) return;
    const owner = core.who.list().find((account) => account.author.pubkey === query.account);
    if (owner && owner.inbox === undefined && !inboxes.has(query.account)) {
      owner.inbox = [];
      core.accounts();
    }
    const error =
      forced ?? access(query) ?? (!inboxes.get(query.account)?.length ? 'not-found' : undefined);
    core.post({
      t: 'dm',
      sub,
      snapshot: privateSnapshot({ query, rows: messages, seen, inboxes, error }),
    });
  };
  const refresh = () => {
    for (const [sub, query] of subscriptions) emit(sub, query);
  };
  return {
    handle(msg: ToEngine): boolean {
      if (editors.handle(msg) || drafts.handle(msg)) return true;
      if (msg.t === 'hint') {
        const wasHidden = pageHidden;
        pageHidden = msg.hint.pageHidden;
        if (wasHidden && !pageHidden) refresh();
        return false;
      }
      if (msg.t === 'act' && msg.action.a.startsWith('account.') && !accountRefresh) {
        accountRefresh = true;
        core.later(0, () => {
          accountRefresh = false;
          const saved = new Set(core.who.list().map((a) => a.author.pubkey));
          for (const key of inboxes.keys()) if (!saved.has(key)) inboxes.delete(key);
          refresh();
        });
      }
      if (msg.t === 'dm.open') {
        const error = access(msg.query);
        if (error) {
          emit(msg.sub, msg.query, error);
          return true;
        }
        if (subscriptions.size >= 32 && !subscriptions.has(msg.sub)) {
          emit(msg.sub, msg.query, 'too-large');
          return true;
        }
        const participants = msg.query.participants
          ? [...new Set([msg.query.account, ...msg.query.participants])].sort()
          : undefined;
        if (
          participants &&
          (participants.length < 2 ||
            participants.length > 32 ||
            participants.some((key) => !/^[0-9a-f]{64}$/.test(key)))
        ) {
          emit(msg.sub, msg.query, 'rejected');
          return true;
        }
        const conversation = participants ? room(participants) : msg.query.conversation;
        const query = { ...msg.query, ...(participants ? { participants, conversation } : {}) };
        subscriptions.set(msg.sub, query);
        if (msg.visible === false) hidden.add(msg.sub);
        else hidden.delete(msg.sub);
        emit(msg.sub, subscriptions.get(msg.sub) ?? msg.query);
        return true;
      }
      if (msg.t === 'dm.close') {
        subscriptions.delete(msg.sub);
        hidden.delete(msg.sub);
        return true;
      }
      if (msg.t === 'dm.visible' || msg.t === 'dm.more') {
        const query = subscriptions.get(msg.sub);
        if (query && msg.t === 'dm.visible') {
          if (msg.visible) hidden.delete(msg.sub);
          else hidden.add(msg.sub);
        }
        if (query && (msg.t === 'dm.more' || msg.visible)) emit(msg.sub, query);
        return true;
      }
      if (msg.t === 'crypted') return true;
      if (msg.t !== 'act' || !['dm.send', 'dm.seen', 'dm.relays.save'].includes(msg.action.a))
        return false;
      const a = msg.action;
      if (a.a !== 'dm.send' && a.a !== 'dm.seen' && a.a !== 'dm.relays.save') return false;
      const account = core.who.list().find((v) => v.author.pubkey === a.as);
      const error = !account
        ? 'signed-out'
        : account.signer === 'none'
          ? 'read-only'
          : account.locked
            ? 'signer-missing'
            : undefined;
      if (error) {
        core.post({ t: 'result', req: msg.req, ok: false, error: { code: error } });
        return true;
      }
      // In the opt-in harness, execute the real mock action only after its independent
      // Worker-owned signature returns. Never attach the action ID as page ownership.
      const signThen = (scenario: 'dm-seal' | 'dm-advertisement', finish: () => void): void => {
        if (!signer || account?.signer !== 'extension') return finish();
        signer.sign(scenario, a.as, msg.req, (reply) => {
          const current = core.who.list().find((v) => v.author.pubkey === a.as);
          if (!reply.event || reply.error || current?.signer !== 'extension' || current.locked) {
            core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'signer-refused' } });
          } else finish();
        });
      };
      if (a.a === 'dm.send') {
        if (
          !a.draft.text ||
          new TextEncoder().encode(a.draft.text).length > 16384 ||
          !a.draft.recipients.length ||
          a.draft.recipients.length > 31 ||
          a.draft.recipients.some((p) => !/^[0-9a-f]{64}$/.test(p)) ||
          (a.draft.subject && new TextEncoder().encode(a.draft.subject).length > 256)
        ) {
          core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'rejected' } });
          return true;
        }
        const peers = [...new Set([a.as, ...a.draft.recipients])].sort();
        if (peers.some((p) => !inboxes.get(p)?.length)) {
          core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'not-found' } });
          return true;
        }
        signThen('dm-seal', () => {
          const conversation = room(peers);
          const id = (++serial).toString(16).padStart(64, '0');
          messages.push({
            id,
            conversation,
            author: a.as,
            participants: peers,
            text: a.draft.text,
            at: core.now(),
            replyTo: a.draft.replyTo ?? null,
            subject: a.draft.subject ?? null,
            unread: false,
            legacy: false,
          });
          if (messages.length > 2000) {
            const removed = messages.shift();
            for (const key of seen) if (key.endsWith(`:${removed?.id}`)) seen.delete(key);
            const retained = new Set(messages.map((m) => m.conversation));
            for (const [peers, key] of rooms) if (!retained.has(key)) rooms.delete(peers);
          }
          core.post({
            t: 'result',
            req: msg.req,
            ok: true,
            id,
            dmDelivery: { accepted: peers.length, total: peers.length },
          });
          refresh();
        });
      } else if (a.a === 'dm.seen') {
        if (
          !messages.some((m) => m.conversation === a.conversation && m.participants.includes(a.as))
        ) {
          core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'not-found' } });
          return true;
        }
        for (const m of messages)
          if (m.conversation === a.conversation && m.participants.includes(a.as))
            seen.add(`${a.as}:${m.id}`);
        core.post({ t: 'result', req: msg.req, ok: true });
      } else {
        const valid = a.relays.length <= 8 && a.relays.every((url) => /^wss?:\/\/[^/]+/.test(url));
        const finish = () => {
          if (valid) {
            inboxes.set(a.as, [...a.relays]);
            const owner = core.who.list().find((account) => account.author.pubkey === a.as);
            if (owner) owner.inbox = [...a.relays];
            core.accounts();
          }
          core.post({
            t: 'result',
            req: msg.req,
            ok: valid,
            ...(valid ? {} : { error: { code: 'rejected' as const } }),
          });
          refresh();
        };
        if (valid) signThen('dm-advertisement', finish);
        else finish();
      }
      if (a.a === 'dm.seen') refresh();
      return true;
    },
    dispose() {
      editors.dispose();
      drafts.dispose();
      subscriptions.clear();
      messages.length = 0;
      seen.clear();
      rooms.clear();
      inboxes.clear();
      hidden.clear();
    },
  };
}
