use super::{Output, Query, Session};
use crate::engine::{
    Engine, query,
    zaps::{Evidence, Phase},
};
use serde_json::{Value, json};
#[derive(Default)]
pub(super) struct Cached {
    base: Option<Value>,
    evidence: Option<Evidence>,
}
fn selected(q: &Query, engine: &Engine, unread: bool) -> Evidence {
    let empty = Evidence {
        phase: Phase::Ready,
        unverified: 0,
        read_limited: false,
    };
    if q.types
        .as_ref()
        .is_some_and(|types| !types.iter().any(|t| t == "zap"))
    {
        return empty;
    }
    let Some(account) = q.account.as_deref() else {
        return empty;
    };
    let Some(converted) = q.convert() else {
        return empty;
    };
    let seen = engine.seen.get(account).copied().unwrap_or(0);
    let events = query::events(&engine.store, &converted);
    let ids = events
        .iter()
        .filter(|event| {
            if event.kind != 9735 {
                return false;
            }
            let at = event.created_at.saturating_mul(1000);
            !unread
                || engine
                    .notification_zaps
                    .get(account)
                    .is_some_and(|state| state.pending(&event.id))
                || at > seen
                || (at == seen
                    && engine
                        .notification_ties
                        .get(account)
                        .is_some_and(|ties| !ties.contains(&event.id)))
        })
        .map(|event| event.id.as_str());
    let mut evidence = engine.zaps.receipts.evidence(
        &engine.store,
        &engine.zaps.providers,
        ids,
        engine.network.now / 1000,
    );
    evidence.read_limited = engine
        .notification_zaps
        .get(account)
        .is_some_and(|state| state.limited);
    if evidence.read_limited && evidence.phase == Phase::Ready {
        evidence.phase = Phase::Failed;
    }
    evidence
}
pub fn unread_zap_evidence(engine: &Engine, account: &str) -> Evidence {
    selected(
        &Query {
            source: "notifications".into(),
            account: Some(account.into()),
            ..Default::default()
        },
        engine,
        true,
    )
}
impl Session {
    pub(super) fn notification_state(
        &mut self,
        sub: Option<&str>,
        out: &mut Vec<Output>,
        engine: &Engine,
    ) {
        let Some(sub) = sub else {
            return;
        };
        let Some(q) = self.queries.get(sub).filter(|q| {
            q.account.is_some() && (q.source == "notifications" || q.notifications == Some(true))
        }) else {
            return;
        };
        let evidence = selected(q, engine, false);
        let cached = self.notification_states.entry(sub.into()).or_default();
        let mut has_state = false;
        for message in out.iter_mut() {
            if let Output::State {
                sub: state_sub,
                state,
            } = message
                && state_sub == sub
            {
                cached.base = Some(state.clone());
                state["zapEvidence"] = json!(evidence);
                has_state = true;
            }
        }
        // Receipt discovery is independent of the relay phase. Only repeat a
        // phase that the network already emitted; initial rows cannot invent one.
        if !has_state
            && cached.evidence != Some(evidence)
            && let Some(base) = cached.base.as_ref()
        {
            let mut state = base.clone();
            state["zapEvidence"] = json!(evidence);
            out.push(Output::State {
                sub: sub.into(),
                state,
            });
        }
        cached.evidence = Some(evidence);
    }
}
