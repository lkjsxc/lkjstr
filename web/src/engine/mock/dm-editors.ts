// One mock Worker represents one page; real multi-client lock coordination is tested against WASM.
import type { FromEngine, ToEngine } from '../protocol.ts';
import type { Core } from './engine.ts';
import { vaultAct } from './vault.ts';
export function createMockDmEditors(core: Core, refresh: () => void) {
  const editors = new Map<string, { account: string; dirty: boolean }>(); // <=32
  let serial = 0;
  let pending: { req: string; actionReq: string; account: string } | undefined;
  const result = (
    req: string,
    ok: boolean,
    error?: Extract<FromEngine, { t: 'result' }>['error'],
  ) => core.post({ t: 'result', req, ok, ...(error ? { error } : {}) });
  const finish = (ok: boolean): void => {
    const current = pending;
    if (!current) return;
    pending = undefined;
    if (ok)
      vaultAct(
        core,
        { a: 'account.lock', pubkey: current.account },
        () => {
          refresh();
          result(current.actionReq, true);
        },
        (code) => result(current.actionReq, false, { code }),
      );
    else result(current.actionReq, false, { code: 'internal' });
    core.post({ t: 'dm.flush', req: current.req, account: current.account, phase: 'release' });
  };
  return {
    handle(message: ToEngine): boolean {
      if (message.t === 'dm.flushed') {
        if (pending?.req === message.req)
          finish(
            message.ok &&
              ![...editors.values()].some((e) => e.account === pending?.account && e.dirty),
          );
        return true;
      }
      if (message.t !== 'act') return false;
      const { action, req } = message;
      if (action.a === 'account.remove') {
        if (pending?.account === action.pubkey) finish(false);
        for (const [key, editor] of editors)
          if (editor.account === action.pubkey) editors.delete(key);
        return false;
      }
      if (action.a === 'dm.editor') {
        const account = core.who.list().find((a) => a.author.pubkey === action.as);
        const old = editors.get(action.editor);
        const code =
          action.open && !account
            ? 'signed-out'
            : action.open && account?.locked
              ? 'signer-missing'
              : action.open && account?.signer === 'none'
                ? 'read-only'
                : !action.editor || action.editor.length > 160 || (old && old.account !== action.as)
                  ? 'rejected'
                  : action.open && !old && editors.size >= 32
                    ? 'too-large'
                    : action.open && !old && pending?.account === action.as
                      ? 'rejected'
                      : undefined;
        if (code) result(req, false, { code });
        else {
          if (action.open)
            editors.set(action.editor, {
              account: action.as,
              dirty: action.dirty ?? old?.dirty ?? false,
            });
          else {
            if (pending?.account === action.as && old) finish(false);
            editors.delete(action.editor);
          }
          result(req, true);
        }
        return true;
      }
      if (
        action.a !== 'account.lock' ||
        ![...editors.values()].some((e) => e.account === action.pubkey)
      )
        return false;
      if (pending) {
        result(req, false, { code: 'rejected' });
        return true;
      }
      const current = { req: `mock-dm-flush-${++serial}`, actionReq: req, account: action.pubkey };
      pending = current;
      core.post({ t: 'dm.flush', req: current.req, account: current.account, phase: 'hold' });
      core.post({ t: 'dm.flush', req: current.req, account: current.account, phase: 'prepare' });
      core.later(15_000, () => {
        if (pending === current) finish(false);
      });
      return true;
    },
    dispose(): void {
      pending = undefined;
      editors.clear();
    },
  };
}
