// Finite engine-only read queries; no zap surface or payment action is introduced.
import type { Transport } from './client.ts';
import type {
  FromEngine,
  ZapQuote,
  ZapQuoteInput,
  ZapReceiptInput,
  ZapReceiptView,
} from './protocol.ts';

type Reply = Extract<FromEngine, { t: 'zap.quote' | 'zap.receipts' }>;
export function createZapClient(transport: Transport) {
  let serial = 0;
  const pending = new Map<string, { reply(message: Reply): void; close(): void }>();
  function start(
    kind: 'zap.quote' | 'zap.receipts',
    query: ZapQuoteInput | ZapReceiptInput,
    receive: (message: Reply | undefined) => void,
  ) {
    if (pending.size >= 16) throw new Error('zap query limit');
    const req = `zq${String(++serial)}`;
    const close = (): void => {
      if (!pending.delete(req)) return;
      clearTimeout(timer);
      transport.post({ t: 'zap.close', req });
    };
    const timer = setTimeout(() => {
      close();
      receive(undefined);
    }, 25_000);
    pending.set(req, {
      close,
      reply(message) {
        const phase = message.t === 'zap.quote' ? message.quote.phase : message.page.phase;
        if (phase !== 'loading') close();
        receive(message);
      },
    });
    if (kind === 'zap.quote') transport.post({ t: kind, req, query: query as ZapQuoteInput });
    else transport.post({ t: kind, req, query: query as ZapReceiptInput });
    return { id: req, close };
  }
  return {
    quote(query: ZapQuoteInput, receive: (quote: ZapQuote) => void) {
      return start('zap.quote', query, (m) => {
        if (m?.t === 'zap.quote') receive(m.quote);
        else if (!m)
          receive({ target: query.target, phase: 'failed', error: 'network', recipients: [] });
      });
    },
    receipts(query: ZapReceiptInput, receive: (page: ZapReceiptView) => void) {
      return start('zap.receipts', query, (m) => {
        if (m?.t === 'zap.receipts') receive(m.page);
        else if (!m)
          receive({
            target: query.target,
            phase: 'failed',
            error: 'network',
            coverage: 'failed',
            page: null,
          });
      });
    },
    receive(message: Reply) {
      pending.get(message.req)?.reply(message);
    },
    dispose() {
      for (const request of pending.values()) request.close();
    },
  };
}
