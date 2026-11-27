//! Private read demand and completion remain separate from ordinary relay completion.
use super::{Output, Session};
use crate::engine::{
    Engine,
    private_lists::{Demand, Status},
};
use serde_json::{Value, json};
use std::collections::BTreeSet;
#[derive(Default)]
pub(super) struct Cached {
    base: Option<Value>,
    status: Option<Status>,
}
impl Session {
    pub fn private_demands(
        &self,
        client: u64,
        engine: &Engine,
        local: &BTreeSet<String>,
    ) -> Vec<Demand> {
        self.queries
            .iter()
            .filter(|(sub, q)| {
                !self.preview_hidden
                    && self
                        .timeline_visible
                        .as_ref()
                        .is_none_or(|v| v.contains(*sub))
                    && q.account
                        .as_ref()
                        .is_some_and(|a| local.contains(a) || q.private_lists == Some(true))
            })
            .filter_map(|(sub, q)| {
                let query = q.convert()?;
                Some(Demand {
                    client,
                    sub: sub.clone(),
                    account: q.account.clone()?,
                    events: crate::engine::private_lists::events(&engine.store, &query),
                    external: q.private_lists == Some(true),
                })
            })
            .collect()
    }
    fn private_status(&self, sub: &str, engine: &Engine) -> Option<Status> {
        let q = self
            .queries
            .get(sub)
            .filter(|q| q.private_lists == Some(true))?;
        let account = q.account.as_deref()?;
        let events = crate::engine::private_lists::events(&engine.store, &q.convert()?);
        Some(engine.private_reads.status(account, &events))
    }
    pub(super) fn private_output(&mut self, out: &mut Output, engine: &Engine) {
        if let Output::State { sub, state } = out {
            let Some(status) = self.private_status(sub, engine) else {
                return;
            };
            let cached = self.private_states.entry(sub.clone()).or_default();
            cached.base = Some(Self::relay_state(state));
            state["privateLists"] = json!(status);
            cached.status = Some(status);
        }
    }
    /// Emits only changed metadata, including completion without a Store revision.
    pub fn private_tick(&mut self, engine: &Engine) -> Vec<Output> {
        let states = self
            .queries
            .keys()
            .filter_map(|sub| {
                self.private_status(sub, engine)
                    .map(|status| (sub.clone(), status))
            })
            .collect::<Vec<_>>();
        let mut out = Vec::new();
        for (sub, status) in states {
            let cached = self.private_states.entry(sub.clone()).or_default();
            if cached.status.as_ref() == Some(&status) {
                continue;
            }
            // A private completion cannot invent or reuse another query's relay phase.
            let Some(mut state) = cached.base.clone() else {
                continue;
            };
            state["privateLists"] = json!(status);
            cached.status = Some(status);
            out.push(Output::State {
                sub: sub.clone(),
                state,
            });
            self.notification_state(Some(&sub), &mut out, engine);
        }
        out
    }
}
