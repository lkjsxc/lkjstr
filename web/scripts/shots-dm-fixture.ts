// Screenshot-only transport answers. These records never enter the product mock or any public relay.
import type { Page } from 'playwright-core';
import { PEOPLE, SELF } from '../src/engine/mock/people.ts';
import type { Author, DmMessage, DmSnapshot } from '../src/engine/protocol.ts';

export async function privateScene(page: Page, scene: string, lang: 'ja' | 'en') {
  const people = [
    SELF.author,
    ...PEOPLE.filter((p) => p.author.pubkey !== SELF.author.pubkey)
      .slice(0, 4)
      .map((p) => p.author),
  ];
  const [self, a, b, c] = people as [Author, Author, Author, Author];
  const room = 'a'.repeat(64),
    group = 'b'.repeat(64),
    now = Date.now();
  const row = (id: number, author: string, text: string, extra = {}): DmMessage => ({
    id: id.toString(16).padStart(64, '0'),
    conversation: room,
    author,
    participants: [self.pubkey, a.pubkey],
    at: now - id * 120000,
    text,
    replyTo: null,
    subject: null,
    legacy: false,
    unread: id < 3,
    segments: [{ k: 'text', text }],
    ...extra,
  });
  const messages = [
    row(
      1,
      a.pubkey,
      lang === 'ja'
        ? 'この続きを、明日の朝に話しましょう。'
        : 'Let us continue this tomorrow morning.',
      {
        replyTo: '3'.padStart(64, '0'),
        reply: {
          id: '3'.padStart(64, '0'),
          author: self.pubkey,
          excerpt:
            lang === 'ja' ? 'ゆっくり読み返していました。' : 'I was reading it again, slowly.',
        },
      },
    ),
    row(
      2,
      a.pubkey,
      lang === 'ja'
        ? '写真はこちらです。\nhttps://example.org/quiet-morning'
        : 'Here is the photograph.\nhttps://example.org/quiet-morning',
      {
        segments: [
          { k: 'text', text: lang === 'ja' ? '写真はこちらです。\n' : 'Here is the photograph.\n' },
          {
            k: 'link',
            url: 'https://example.org/quiet-morning',
            text: 'example.org/quiet-morning',
          },
        ],
      },
    ),
    row(
      3,
      self.pubkey,
      lang === 'ja' ? 'ゆっくり読み返していました。' : 'I was reading it again, slowly.',
    ),
    row(
      4,
      a.pubkey,
      lang === 'ja'
        ? '去年のメモも、ここに残っていました。'
        : 'The notes from last year were still here.',
      { legacy: true, at: now - 86400000 },
    ),
  ];
  const groupRows = [
    row(
      5,
      b.pubkey,
      lang === 'ja' ? '土曜日は、この場所に集合しませんか。' : 'Shall we meet here on Saturday?',
      {
        conversation: group,
        participants: [self.pubkey, a.pubkey, b.pubkey, c.pubkey],
        subject: lang === 'ja' ? '週末の散歩' : 'A walk this weekend',
      },
    ),
    row(6, c.pubkey, lang === 'ja' ? '午前中なら行けます。' : 'I can come in the morning.', {
      conversation: group,
      participants: [self.pubkey, a.pubkey, b.pubkey, c.pubkey],
    }),
  ];
  const snapshot: DmSnapshot = {
    account: self.pubkey,
    conversations: [
      {
        key: room,
        participants: [self.pubkey, a.pubkey],
        last: messages[0]!,
        unread: 2,
        recentAuthors: [a.pubkey],
      },
      {
        key: group,
        participants: [self.pubkey, a.pubkey, b.pubkey, c.pubkey],
        last: groupRows[0]!,
        unread: 4,
        recentAuthors: [b.pubkey, c.pubkey],
      },
    ],
    messages,
    people,
    unread: 6,
    blocked: [],
    more: false,
    undecryptable: 0,
    phase: 'live',
  };
  await page.evaluate(
    ({ scene, snapshot, groupRows, self }) =>
      new Promise<void>((resolve) => {
        const original = Worker.prototype.postMessage;
        let initialized = false;
        const queries = new Map<
          string,
          {
            account: string;
            participants?: string[];
            conversation?: string;
            unreadOnly?: boolean;
            before?: string;
          }
        >();
        const answer = (worker: Worker, value: unknown): void => {
          queueMicrotask(() => worker.dispatchEvent(new MessageEvent('message', { data: value })));
        };
        const send = (worker: Worker, sub: string): void => {
          const query = queries.get(sub);
          if (!query) return;
          const isGroup =
            (query.participants?.length ?? 0) > 1 ||
            query.conversation === groupRows[0]?.conversation;
          const inRoom = !!query.participants || !!query.conversation;
          let value = {
            ...snapshot,
            conversation: inRoom
              ? isGroup
                ? groupRows[0]?.conversation
                : snapshot.conversations[0]?.key
              : undefined,
            conversations: inRoom || query.unreadOnly ? [] : snapshot.conversations,
            messages: inRoom && !query.unreadOnly ? (isGroup ? groupRows : snapshot.messages) : [],
          };
          if (scene === 'loading')
            value = { ...value, conversations: [], messages: [], phase: 'loading' };
          if (scene === 'empty') value = { ...value, conversations: [], messages: [] };
          if (scene === 'first' && inRoom) value = { ...value, messages: [] };
          if (scene === 'failed') value = { ...value, phase: 'failed', error: 'offline' };
          if (scene === 'refused') value = { ...value, phase: 'failed', error: 'signer-refused' };
          if (scene === 'nobody')
            value = { ...value, blocked: [snapshot.people?.[1]?.pubkey ?? ''] };
          if (scene === 'paging' && inRoom)
            value = {
              ...value,
              more: true,
              phase: 'loading',
              messages: query.before ? [] : snapshot.messages,
            };
          answer(worker, { t: 'dm', sub, snapshot: value });
        };
        Worker.prototype.postMessage = function (
          message: {
            t?: string;
            sub?: string;
            query?: never;
            req?: string;
            action?: { a: string };
          },
          options?: StructuredSerializeOptions | Transferable[],
        ) {
          if (!initialized) {
            initialized = true;
            const account = {
              author: self,
              signer: scene === 'ask' ? 'extension' : scene === 'readonly' ? 'none' : 'local',
              unread: 0,
              inbox:
                scene === 'setup' || scene === 'relays-suggest'
                  ? []
                  : [
                      'wss://inbox-one.example',
                      'wss://inbox-two.example',
                      'wss://inbox-three.example',
                    ],
              encrypted: scene === 'locked',
              locked: scene === 'locked',
            };
            // A brief account refresh closes any pre-fixture count watch; the next query gets only these answers.
            answer(this, {
              t: 'accounts',
              accounts: [{ ...account, locked: true }],
              active: self.pubkey,
            });
            answer(this, { t: 'accounts', accounts: [account], active: self.pubkey });
            queueMicrotask(resolve);
          }
          if (message.t === 'dm.open' && message.sub && message.query) {
            queries.set(message.sub, message.query);
            send(this, message.sub);
            return;
          }
          if (message.t === 'dm.close' && message.sub) {
            queries.delete(message.sub);
            return;
          }
          if (message.t === 'dm.more' && message.sub) {
            send(this, message.sub);
            return;
          }
          if (message.t === 'dm.visible') return;
          if (message.t === 'act' && message.action?.a.startsWith('dm.')) {
            if (message.action.a === 'dm.send') {
              if (scene === 'pending') return;
              answer(this, {
                t: 'result',
                req: message.req,
                ok: false,
                error: { code: scene === 'send-refused' ? 'signer-refused' : 'no-relays' },
                ...(scene === 'partial' ? { dmDelivery: { accepted: 1, total: 2 } } : {}),
              });
            } else
              answer(this, {
                t: 'result',
                req: message.req,
                ok: true,
                ...(message.action.a.startsWith('dm.draft.')
                  ? { dmDraftRevision: 'shot-archive-revision' }
                  : {}),
              });
            return;
          }
          Reflect.apply(original, this, [message, options]);
        };
        document.dispatchEvent(new Event('visibilitychange'));
      }),
    { scene, snapshot, groupRows, self },
  );
}
