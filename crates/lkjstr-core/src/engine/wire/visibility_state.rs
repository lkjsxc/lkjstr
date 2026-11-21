//! Evidence that has no verified timeline slot. Never attach an event or identity.
use super::{Output, Session};
use crate::engine::Engine;
use serde_json::{Value, json};

// One small record per open subscription; Open and Close drop its history.
#[derive(Default)]
pub(super) struct Cached {
    state: Option<Value>,
    invalid: u64,
    unavailable: usize,
    pruned: bool,
}

impl Cached {
    fn project(&self, state: &mut Value) {
        let mut evidence = Vec::with_capacity(4);
        if self.invalid > 0 {
            evidence.push(json!({"reason":"invalid","count":self.invalid,"exact":true}));
        }
        if self.pruned {
            evidence.push(json!({"reason":"pruned","exact":false}));
        }
        if state["phase"] == "failed"
            && state["relaysAsked"].as_u64() > state["relaysAnswered"].as_u64()
        {
            evidence.push(json!({"reason":"undelivered","exact":false}));
        }
        if self.unavailable > 0 {
            // The raw window can contain several wrappers of one unavailable target.
            evidence.push(json!({"reason":"unavailable-repost","exact":false}));
        }
        if !evidence.is_empty() {
            state["unshown"] = json!(evidence);
        } else if let Some(fields) = state.as_object_mut() {
            fields.remove("unshown");
        }
    }
}

impl Session {
    pub(super) fn visibility_state(&mut self, output: &mut [Output]) {
        for message in output {
            if let Output::State { sub, state } = message
                && self.queries.contains_key(sub)
            {
                let cached = self.visibility_states.entry(sub.clone()).or_default();
                cached.project(state);
                cached.state = Some(state.clone());
            }
        }
    }

    pub(super) fn update_visibility(
        &mut self,
        sub: String,
        invalid: u64,
        unavailable: usize,
    ) -> Vec<Output> {
        if !self.queries.contains_key(&sub) {
            return vec![];
        }
        let cached = self.visibility_states.entry(sub.clone()).or_default();
        cached.invalid = invalid;
        cached.unavailable = unavailable;
        let Some(previous) = &cached.state else {
            return vec![];
        };
        let mut state = previous.clone();
        cached.project(&mut state);
        if state == *previous {
            return vec![];
        }
        cached.state = Some(state.clone());
        vec![Output::State { sub, state }]
    }

    pub(super) fn evidence_of_pruning(&mut self, sub: &str, previous: &[Value], engine: &Engine) {
        let cached = self.visibility_states.entry(sub.into()).or_default();
        if !cached.pruned {
            cached.pruned = previous.iter().any(|row| {
                row["kind"] == "note"
                    && row["id"].as_str().is_some_and(|id| {
                        engine.store.was_evicted(id)
                            && !engine.store.verified_deleted(id)
                            && !engine.store.verified_expired(id)
                    })
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evidence_waits_for_an_observed_phase_and_does_not_count_unknown_notes() {
        let mut session = Session::default();
        session.queries.insert("a".into(), Default::default());
        assert!(session.update_visibility("a".into(), 2, 3).is_empty());
        let state = json!({"phase":"failed","relaysAsked":2,"relaysAnswered":1});
        let mut message = [Output::State {
            sub: "a".into(),
            state,
        }];
        session.visibility_state(&mut message);
        if let [Output::State { state, .. }] = &message {
            assert_eq!(
                state["unshown"],
                json!([
                    {"reason":"invalid","count":2,"exact":true},
                    {"reason":"undelivered","exact":false},
                    {"reason":"unavailable-repost","exact":false}
                ])
            );
        }
        assert!(session.update_visibility("a".into(), 2, 3).is_empty());
        assert!(session.update_visibility("other".into(), 1, 1).is_empty());
        assert_eq!(session.update_visibility("a".into(), 2, 0).len(), 1);
    }
}
