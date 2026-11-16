// The mock retains private draft state only in this worker's memory; it never claims real encryption.
import type { DmDraftState, FromEngine, ToEngine } from '../protocol.ts';
import type { Core } from './engine.ts';
export function createMockPrivateDrafts(core: Core) {
  const records = new Map<string, Map<string, DmDraftState>>(); // 32 tabs / 2MiB for each of <=32 accounts
  let serial = 0;
  const versions = new Map<string, Map<string, string>>(); // <=64 live/tombstone tokens per account
  return {
    handle(message: ToEngine): boolean {
      if (message.t !== 'act') return false;
      const { action, req } = message;
      if (action.a === 'account.remove') {
        records.delete(action.pubkey);
        versions.delete(action.pubkey);
      }
      if (
        action.a !== 'dm.draft.load' &&
        action.a !== 'dm.draft.save' &&
        action.a !== 'dm.draft.clear'
      )
        return false;
      const account = core.who.list().find((a) => a.author.pubkey === action.as);
      const code = !account
        ? 'signed-out'
        : account.signer === 'none'
          ? 'read-only'
          : account.locked
            ? 'signer-missing'
            : !action.tab || action.tab.length > 160
              ? 'rejected'
              : undefined;
      const result = (extra: Partial<Extract<FromEngine, { t: 'result' }>>): void =>
        core.post({ t: 'result', req, ok: true, ...extra });
      if (code) {
        result({ ok: false, error: { code } });
        return true;
      }
      const tabs = records.get(action.as) ?? new Map<string, DmDraftState>();
      const tokens = versions.get(action.as) ?? new Map<string, string>();
      const bump = (): string => {
        const token = `mock-draft-${++serial}`;
        tokens.set(action.tab, token);
        return token;
      };
      if (!tokens.has(action.tab)) {
        if (tokens.size >= 64) {
          const old = [...tokens.keys()].find((key) => !tabs.has(key));
          if (old) tokens.delete(old);
        }
        bump();
        versions.set(action.as, tokens);
      }
      const revision = tokens.get(action.tab);
      if (
        action.a !== 'dm.draft.load' &&
        action.expected !== undefined &&
        action.expected !== revision
      ) {
        result({ ok: false, error: { code: 'rejected' } });
        return true;
      }
      const size = (value: unknown): number =>
        new TextEncoder().encode(JSON.stringify(value)).length;
      if (action.a === 'dm.draft.load') {
        const state = tabs.get(action.tab);
        result({
          dmDraftRevision: revision,
          ...(state ? { dmDraft: structuredClone(state) } : {}),
        });
      } else if (action.a === 'dm.draft.clear') {
        tabs.delete(action.tab);
        result({ dmDraftRevision: bump() });
      } else {
        const bytes = size(action.state),
          old = tabs.get(action.tab);
        const total =
          [...tabs.values()].reduce((sum, value) => sum + size(value), 0) -
          (old ? size(old) : 0) +
          bytes;
        if (
          action.state.failed.length > 32 ||
          bytes > 262144 ||
          (!old && tabs.size >= 32) ||
          total > 2097152
        )
          result({ ok: false, error: { code: 'too-large' } });
        else {
          tabs.set(action.tab, structuredClone(action.state));
          records.set(action.as, tabs);
          result({ dmDraftRevision: bump() });
        }
      }
      return true;
    },
    dispose(): void {
      records.clear();
      versions.clear();
    },
  };
}
