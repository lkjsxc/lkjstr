// The test double's private stream is separate from its public note world.

import type { DmMessage, DmQuery, DmSnapshot, ToEngine } from '../protocol.ts';
import type { Core } from './engine.ts';
export function createPrivateMock(core: Core) {
  let serial = 0;
  const subscriptions = new Map<string, DmQuery>(); // <=32 private views
  const messages: DmMessage[] = []; // <=2000 mock messages
  const seen = new Set<string>(); // <=2000 messages x32 participants
  const inboxes = new Map<string, readonly string[]>(); // <=32 saved mock accounts
  const hidden = new Set<string>(); // <=32 private views
  let accountRefresh = false;
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
  const emit = (sub: string, query: DmQuery, forced?: string): void => {
    if (hidden.has(sub)) return;
    const account = core.who.list().find((a) => a.author.pubkey === query.account);
    const error =
      forced ??
      (!account
        ? 'signed-out'
        : account.signer === 'none'
          ? 'read-only'
          : account.locked
            ? 'signer-missing'
            : !inboxes.has(query.account)
              ? 'not-found'
              : undefined);
    const rows = error
      ? []
      : messages
          .filter((m) => m.participants.includes(query.account))
          .map((m) => ({
            ...m,
            unread: m.author !== query.account && !seen.has(query.account + ':' + m.id),
          }))
          .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
    const conversations: DmSnapshot['conversations'][number][] = [];
    for (const message of rows) {
      let conversation = conversations.find((c) => c.key === message.conversation);
      if (!conversation) {
        conversation = {
          key: message.conversation,
          participants: message.participants,
          last: message,
          unread: 0,
        };
        conversations.push(conversation);
      }
    }
    const selected = rows.filter((m) => m.conversation === query.conversation);
    const start = query.before
      ? Math.max(0, selected.findIndex((m) => m.id === query.before) + 1)
      : 0;
    const limit = Math.max(1, Math.min(200, query.limit ?? 100));
    core.post({
      t: 'dm',
      sub,
      snapshot: {
        account: query.account,
        conversations: conversations.slice(0, 200).map((c) => ({
          ...c,
          unread: rows.filter((m) => m.conversation === c.key && m.unread).length,
        })),
        messages: selected.slice(start, start + limit),
        more: selected.length > start + limit,
        undecryptable: 0,
        phase: error === 'not-found' ? 'unsupported' : error ? 'failed' : 'live',
        ...(error ? { error } : {}),
      },
    });
  };
  const refresh = () => {
    for (const [sub, query] of subscriptions) emit(sub, query);
  };
  return {
    handle(msg: ToEngine): boolean {
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
        if (subscriptions.size >= 32 && !subscriptions.has(msg.sub)) {
          emit(msg.sub, msg.query, 'too-large');
          return true;
        }
        subscriptions.set(msg.sub, msg.query);
        hidden.delete(msg.sub);
        emit(msg.sub, msg.query);
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
        if (peers.some((p) => !inboxes.has(p))) {
          core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'not-found' } });
          return true;
        }
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
          for (const key of seen) if (key.endsWith(':' + removed?.id)) seen.delete(key);
          const retained = new Set(messages.map((m) => m.conversation));
          for (const [peers, key] of rooms) if (!retained.has(key)) rooms.delete(peers);
        }
        core.post({ t: 'result', req: msg.req, ok: true, id });
      } else if (a.a === 'dm.seen') {
        if (
          !messages.some((m) => m.conversation === a.conversation && m.participants.includes(a.as))
        ) {
          core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'not-found' } });
          return true;
        }
        for (const m of messages)
          if (m.conversation === a.conversation && m.participants.includes(a.as))
            seen.add(a.as + ':' + m.id);
        core.post({ t: 'result', req: msg.req, ok: true });
      } else {
        const valid =
          a.relays.length > 0 &&
          a.relays.length <= 8 &&
          a.relays.every((url) => /^wss?:\/\/[^/]+/.test(url));
        if (valid) inboxes.set(a.as, [...a.relays]);
        core.post({
          t: 'result',
          req: msg.req,
          ok: valid,
          ...(valid ? {} : { error: { code: 'rejected' as const } }),
        });
      }
      refresh();
      return true;
    },
    dispose() {
      subscriptions.clear();
      messages.length = 0;
      seen.clear();
      rooms.clear();
      inboxes.clear();
      hidden.clear();
    },
  };
}
