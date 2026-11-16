// A lost save acknowledgement can refresh its token only against an exact known archive snapshot.
import type { Engine } from '../engine/client.ts';
import type { DmDraft, DmDraftState, Failure } from '../engine/protocol.ts';

function encoded(state: DmDraftState | undefined): string | undefined {
  const draft = (d: DmDraft) => ({
    recipients: d.recipients,
    text: d.text,
    replyTo: d.replyTo ?? undefined,
    subject: d.subject ?? undefined,
    emoji: d.emoji?.map(({ code, url }) => ({ code, url })),
  });
  return state === undefined
    ? undefined
    : JSON.stringify({
        draft: draft(state.draft),
        failed: state.failed.map((row) => ({
          key: row.key,
          draft: draft(row.draft),
          error: row.error ? { code: row.error.code } : undefined,
          dmDelivery: row.dmDelivery
            ? { accepted: row.dmDelivery.accepted, total: row.dmDelivery.total }
            : undefined,
          id: row.id ?? undefined,
        })),
      });
}
export function createDmDraftArchive(o: {
  engine: Engine;
  account: string;
  tab: string;
  failed(error: Failure): void;
}) {
  let expected: string | undefined, confirmed: DmDraftState | undefined;
  let attempt: DmDraftState | undefined,
    uncertain = false,
    stopped = false;
  const load = () => o.engine.act({ a: 'dm.draft.load', as: o.account, tab: o.tab });
  const recover = async (): Promise<boolean> => {
    const result = await load();
    if (stopped) return false;
    if (!result.ok || result.dmDraftRevision === undefined) {
      o.failed(result.error ?? { code: 'rejected' });
      return false;
    }
    const disk = encoded(result.dmDraft);
    if (disk !== encoded(confirmed) && (!attempt || disk !== encoded(attempt))) {
      o.failed({ code: 'rejected' });
      return false;
    }
    expected = result.dmDraftRevision;
    confirmed = result.dmDraft;
    attempt = undefined;
    uncertain = false;
    return true;
  };
  return {
    load,
    accept(state: DmDraftState | undefined, revision: string): void {
      confirmed = state;
      expected = revision;
      attempt = undefined;
      uncertain = false;
    },
    uncertain: () => uncertain,
    async save(state: DmDraftState): Promise<boolean> {
      if (stopped || (uncertain && !(await recover()))) return false;
      attempt = state;
      const result = await o.engine.act({
        a: 'dm.draft.save',
        as: o.account,
        tab: o.tab,
        state,
        expected,
      });
      if (stopped) return false;
      if (result.ok && result.dmDraftRevision !== undefined) {
        expected = result.dmDraftRevision;
        confirmed = state;
        attempt = undefined;
        uncertain = false;
        return true;
      }
      uncertain = true;
      o.failed(result.error ?? { code: 'rejected' });
      return false;
    },
    dispose(): void {
      stopped = true;
      expected = undefined;
      attempt = confirmed = undefined;
    },
  };
}
