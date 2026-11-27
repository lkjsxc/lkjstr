//! Public pin references can still be loading after the list itself made a relay read live.
use super::{Output, Query, Session};
use crate::engine::{Engine, pins};
use serde::Serialize;
use serde_json::{Value, json};

#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize)]
struct Evidence {
    pending: usize,
    unavailable: usize,
}

// One bounded record per open pins subscription, released on Open and Close.
#[derive(Default)]
pub(super) struct Cached {
    base: Option<Value>,
    evidence: Option<Evidence>,
}

fn evidence(q: &Query, engine: &Engine) -> Evidence {
    let owner = q.convert().and_then(|q| q.target);
    let mut result = Evidence::default();
    for id in pins::ids(&engine.store, owner.as_deref()) {
        if engine.store.verified_deleted(&id) || engine.store.verified_expired(&id) {
            result.unavailable += 1;
        } else if let Some(event) = engine.store.lease(&id) {
            if !crate::kinds::policy(event.kind).openable {
                result.unavailable += 1;
            }
        } else if engine.network.lookup_complete(&id) || engine.network.lookup_failed(&id) {
            result.unavailable += 1;
        } else {
            result.pending += 1;
        }
    }
    result
}

impl Session {
    pub(super) fn pins_state(&mut self, sub: Option<&str>, out: &mut Vec<Output>, engine: &Engine) {
        let Some(sub) = sub else { return };
        let Some(q) = self.queries.get(sub).filter(|q| q.source == "pins") else {
            return;
        };
        let evidence = evidence(q, engine);
        let cached = self.pins_states.entry(sub.into()).or_default();
        let mut has_state = false;
        for message in out.iter_mut() {
            if let Output::State {
                sub: state_sub,
                state,
            } = message
                && state_sub == sub
            {
                cached.base = Some(Self::relay_state(state));
                state["pins"] = json!(evidence);
                has_state = true;
            }
        }
        // Keep the observed relay phase; reference lookup completion cannot invent one.
        if !has_state
            && cached.evidence != Some(evidence)
            && let Some(base) = &cached.base
        {
            let mut state = base.clone();
            state["pins"] = json!(evidence);
            out.push(Output::State {
                sub: sub.into(),
                state,
            });
        }
        cached.evidence = Some(evidence);
    }
}
