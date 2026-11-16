// Explicit mock fixtures. Returned invoice strings cannot be paid.
import type { FromEngine, ToEngine, ZapQuote, ZapReceiptView, ZapTarget } from '../protocol.ts';
import type { Core } from './engine.ts';
import { byPubkey, SELF } from './people.ts';

const PROVIDER = 'f'.repeat(64);
export const MOCK_ZAP_EVIDENCE = { phase: 'ready' as const, unverified: 0 };
type Pending = { account?: string; valid?(): boolean; cancel(error?: 'signer-missing'): void };
export function createZapMock(core: Core) {
  const pending = new Map<string, Pending>();
  const person = (target: ZapTarget) =>
    target.k === 'event'
      ? core.world.byId.get(target.id)?.by.author.pubkey
      : byPubkey(target.pubkey)?.author.pubkey;
  const cancel = (req: string, error?: 'signer-missing'): void => {
    const entry = pending.get(req);
    pending.delete(req);
    entry?.cancel(error);
  };
  const quote = (target: ZapTarget, amount?: number): ZapQuote => {
    const pubkey = person(target);
    const error = !pubkey
      ? 'not-found'
      : amount !== undefined &&
          (!Number.isSafeInteger(amount) || amount < 1000 || amount > 9_000_000_000)
        ? 'rejected'
        : null;
    return {
      target,
      phase: error ? 'failed' : 'ready',
      error,
      recipients: pubkey
        ? [
            {
              pubkey,
              phase: error ? 'failed' : 'ready',
              error,
              amountMsat: amount ?? null,
              minMsat: 1000,
              maxMsat: 9_000_000_000,
              provider: PROVIDER,
              domain: 'fixture.invalid',
              description: 'mock payment fixture',
            },
          ]
        : [],
    };
  };
  const page = (target: ZapTarget): ZapReceiptView => {
    const pubkey = person(target);
    if (!pubkey)
      return { target, phase: 'failed', error: 'not-found', coverage: 'failed', page: null };
    const note = target.k === 'event' ? core.world.byId.get(target.id) : undefined;
    const sats = note?.zaps ?? 0;
    const rows = sats
      ? [
          {
            id: 'a'.repeat(64),
            createdAt: note?.at ?? core.now(),
            target,
            sender: { k: 'public' as const, pubkey: SELF.author.pubkey },
            recipient: pubkey,
            provider: PROVIDER,
            amountMsat: String(sats * 1000),
            verification: 'provider-authorized' as const,
            recipientProfile: 'b'.repeat(64),
            providerEndpoint: 'https://fixture.invalid/.well-known/lnurlp/mock',
            providerObservedAt: core.now(),
            verifiedAt: core.now(),
          },
        ]
      : [];
    return {
      target,
      phase: 'ready',
      error: null,
      coverage: note?.partial ? 'truncated' : 'observed',
      page: {
        target,
        rows,
        total: {
          amountMsat: String(sats * 1000),
          sats,
          receipts: rows.length,
          unverified: 0,
          phase: 'ready',
          limited: false,
        },
        cursor: null,
        more: false,
      },
    };
  };
  return {
    handle(msg: ToEngine): boolean {
      if (msg.t === 'zap.close') {
        cancel(msg.req);
        return true;
      }
      if (msg.t === 'detach') {
        pending.clear();
        return false;
      }
      if (msg.t === 'zap.quote' || msg.t === 'zap.receipts') {
        if (pending.has(msg.req)) return true;
        if (pending.size >= 16) {
          if (msg.t === 'zap.quote')
            core.post({
              t: 'zap.quote',
              req: msg.req,
              quote: {
                target: msg.query.target,
                phase: 'failed',
                error: 'too-large',
                recipients: [],
              },
            });
          else
            core.post({
              t: 'zap.receipts',
              req: msg.req,
              page: {
                target: msg.query.target,
                phase: 'failed',
                error: 'too-large',
                coverage: 'failed',
                page: null,
              },
            });
          return true;
        }
        const entry: Pending = { cancel() {} };
        pending.set(msg.req, entry);
        if (msg.t === 'zap.quote')
          core.post({
            t: 'zap.quote',
            req: msg.req,
            quote: { target: msg.query.target, phase: 'loading', error: null, recipients: [] },
          });
        else
          core.post({
            t: 'zap.receipts',
            req: msg.req,
            page: {
              target: msg.query.target,
              phase: 'loading',
              error: null,
              coverage: 'loading',
              page: null,
            },
          });
        core.later(120, () => {
          if (pending.get(msg.req) !== entry) return;
          pending.delete(msg.req);
          if (msg.t === 'zap.quote')
            core.post({
              t: 'zap.quote',
              req: msg.req,
              quote: quote(msg.query.target, msg.query.amountMsat),
            });
          else {
            let view = page(msg.query.target);
            if (view.page && msg.query.before) view = { ...view, page: { ...view.page, rows: [] } };
            core.post({ t: 'zap.receipts', req: msg.req, page: view });
          }
        });
        return true;
      }
      if (msg.t !== 'act' || msg.action.a !== 'zap.invoice') return false;
      if (pending.has(msg.req)) return true;
      const action = msg.action;
      const account = core.who.list().find((a) => a.author.pubkey === action.as);
      const q = quote(action.intent.target, action.intent.amountMsat);
      if (!account || account.signer === 'none' || account.locked) {
        core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'signer-missing' } });
        return true;
      }
      if (q.phase !== 'ready' || action.intent.comment.length > 4096) {
        core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'rejected' } });
        return true;
      }
      if ([...pending.values()].filter((p) => p.account).length >= 4) {
        core.post({ t: 'result', req: msg.req, ok: false, error: { code: 'too-large' } });
        return true;
      }
      const initial = {
        signer: account.signer,
        encrypted: account.encrypted,
        locked: account.locked,
      };
      const entry: Pending = {
        account: action.as,
        valid() {
          const current = core.who.list().find((a) => a.author.pubkey === action.as);
          return (
            current === account &&
            current.signer === initial.signer &&
            current.encrypted === initial.encrypted &&
            current.locked === initial.locked
          );
        },
        cancel(error) {
          core.post(
            error
              ? { t: 'result', req: msg.req, ok: false, error: { code: error } }
              : { t: 'result', req: msg.req, ok: false, cancelled: true },
          );
        },
      };
      pending.set(msg.req, entry);
      core.later(120, () => {
        if (pending.get(msg.req) !== entry) return;
        pending.delete(msg.req);
        const recipient = q.recipients[0];
        if (!recipient) return;
        const out: FromEngine = {
          t: 'result',
          req: msg.req,
          ok: true,
          zapIntent: {
            state: 'unpaid',
            target: action.intent.target,
            amountMsat: action.intent.amountMsat,
            invoices: [
              {
                state: 'unpaid',
                recipient: recipient.pubkey,
                provider: PROVIDER,
                target: action.intent.target,
                amountMsat: action.intent.amountMsat,
                invoice: 'mock-zap-invoice:' + msg.req,
                paymentHash: 'c'.repeat(64),
                expiresAt: core.now() + 60_000,
                successAction: null,
              },
            ],
          },
        };
        core.post(out);
      });
      return true;
    },
    observe(msg: FromEngine): void {
      if (msg.t !== 'accounts') return;
      for (const [req, p] of pending) if (p.valid && !p.valid()) cancel(req, 'signer-missing');
    },
    dispose() {
      pending.clear();
    },
  };
}
