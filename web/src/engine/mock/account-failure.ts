// Failed-account boot fixture; no account rows or signer work are invented.
import type { FromEngine, ToEngine } from '../protocol.ts';
export function failedAccountInput(post: (message: FromEngine) => void, message: ToEngine): void {
  if (message.t === 'act')
    post({ t: 'result', req: message.req, ok: false, error: { code: 'internal' } });
  else if (message.t === 'open')
    post({
      t: 'state',
      sub: message.sub,
      state: { phase: 'failed', relaysAsked: 0, relaysAnswered: 0, error: 'internal' },
    });
  else if (message.t === 'dm.open')
    post({
      t: 'dm',
      sub: message.sub,
      snapshot: {
        account: message.query.account,
        conversations: [],
        messages: [],
        more: false,
        undecryptable: 0,
        phase: 'failed',
        error: 'internal',
      },
    });
  else if (message.t === 'zap.quote')
    post({
      t: 'zap.quote',
      req: message.req,
      quote: {
        target: message.query.target,
        phase: 'failed',
        error: 'rejected',
        recipients: [],
      },
    });
  else if (message.t === 'zap.receipts')
    post({
      t: 'zap.receipts',
      req: message.req,
      page: {
        target: message.query.target,
        phase: 'failed',
        error: 'rejected',
        coverage: 'failed',
        page: null,
      },
    });
  else if (message.t === 'heartbeat') post({ t: 'heartbeat' });
  else if (message.t === 'rowAtTime')
    post({ t: 'rowAtTime', req: message.req, sub: message.sub, cached: false });
}
