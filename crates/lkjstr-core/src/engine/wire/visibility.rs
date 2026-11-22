//! A reveal carries no new lookup or write authority. Only the current client
//! can reveal a retained verified note delivered to its current subscription.
use super::{Output, Session, note};
use crate::engine::{
    Engine,
    protocol::Query,
    rows,
    visibility::{self, Reason},
};
use lkjstr_protocol::NostrEvent;
use serde_json::{Value, json};
use std::collections::BTreeMap;

// At most 256 choices per open subscription, at most 128 subscriptions per client.
#[derive(Default)]
pub(super) struct Reveals {
    reasons: BTreeMap<String, Reason>,
}

pub(super) fn nested_hidden(engine: &Engine, account: Option<&str>, event: &NostrEvent) -> bool {
    let query = Query {
        account: account.map(str::to_owned),
        ..Default::default()
    };
    !crate::kinds::policy(event.kind).openable
        || visibility::reason(&engine.store, &query, event, &engine.private_lists).is_some()
}

fn reason(row: &Value, field: &str) -> Option<Reason> {
    serde_json::from_value(row.get(field)?.get("reason")?.clone()).ok()
}

impl Session {
    pub(super) fn project_event(
        &self,
        sub: &str,
        engine: &Engine,
        query: &Query,
        event: &NostrEvent,
        extra: Option<Reason>,
    ) -> Value {
        let reason = extra
            .or_else(|| visibility::reason(&engine.store, query, event, &engine.private_lists));
        let model = if let Some(reason) = reason {
            visibility::covered_row(&engine.store, event, reason)
        } else {
            rows::row_with_lists(
                &engine.store,
                event,
                query.account.as_deref(),
                0,
                &engine.private_lists,
            )
        };
        self.project_note(sub, engine, &model)
    }

    pub(super) fn project_note(&self, sub: &str, engine: &Engine, row: &rows::Row) -> Value {
        let account = self.queries.get(sub).and_then(|q| q.account.as_deref());
        let mut value = note::note(row, &engine.store, account);
        if let Some(reading_at) = row.window_reading_at {
            value["readingAt"] = json!(reading_at.saturating_mul(1000));
        }
        let Some(reason) = row.hidden_reason else {
            return value;
        };
        if let Some(event) = engine.store.get(&row.id) {
            if reason.revealable()
                && self
                    .reveals
                    .get(sub)
                    .and_then(|set| set.reasons.get(&row.id))
                    == Some(&reason)
            {
                value = self.revealed_note(engine, account, &event, reason, &value);
            } else if let Some(detail) = crate::engine::query_hidden::detail(
                &engine.store,
                account,
                &event,
                reason,
                &engine.private_lists,
            ) {
                value["hidden"]["detail"] = json!(detail);
            }
        }
        value
    }

    fn revealed_note(
        &self,
        engine: &Engine,
        account: Option<&str>,
        event: &NostrEvent,
        reason: Reason,
        identity: &Value,
    ) -> Value {
        let model = rows::row_with_lists(&engine.store, event, account, 0, &engine.private_lists);
        let mut value = note::note(&model, &engine.store, account);
        for field in ["key", "at", "thread", "readingAt"] {
            if let Some(old) = identity.get(field) {
                value[field] = old.clone();
            }
        }
        value["revealed"] = json!({"reason":reason});
        super::quote_state::settle(&mut value, engine, account);
        value
    }

    pub fn note_reveal(
        &mut self,
        req: String,
        sub: &str,
        key: &str,
        reveal: bool,
        engine: &Engine,
    ) -> Vec<Output> {
        let result = self.set_note_reveal(sub, key, reveal, engine);
        let mut out = vec![];
        match result {
            Ok(ops) => {
                if !ops.is_empty() {
                    out.push(Output::Patch {
                        sub: sub.into(),
                        ops,
                    });
                }
                let mut output = Self::failure(req, "internal");
                if let Output::Result { ok, error, .. } = &mut output {
                    *ok = true;
                    *error = None;
                }
                out.push(output);
            }
            Err(code) => out.push(Self::failure(req, code)),
        }
        out
    }

    fn set_note_reveal(
        &mut self,
        sub: &str,
        key: &str,
        reveal: bool,
        engine: &Engine,
    ) -> Result<Vec<Value>, &'static str> {
        if key.len() > 256
            || self.preview_hidden
            || self
                .timeline_visible
                .as_ref()
                .is_some_and(|visible| !visible.contains(sub))
        {
            return Err("not-found");
        }
        let rows = self.delivered.get(sub).ok_or("not-found")?;
        let index = rows
            .iter()
            .position(|row| row["kind"] == "note" && row["key"] == key)
            .ok_or("not-found")?;
        let current = &rows[index];
        let id = current["id"].as_str().ok_or("not-found")?.to_owned();
        let event = engine.store.get(&id).ok_or("not-found")?;
        let covered = reason(current, "hidden");
        let revealed = reason(current, "revealed");
        let reason = covered
            .or(revealed)
            .filter(|reason| reason.revealable())
            .ok_or("not-found")?;
        if reveal == revealed.is_some() {
            return Ok(vec![]);
        }
        let previous_choice = if reveal {
            let set = &mut self.reveals.entry(sub.into()).or_default().reasons;
            if set.len() >= 256 && !set.contains_key(&id) {
                return Err("too-large");
            }
            set.insert(id.clone(), reason)
        } else {
            self.reveals
                .get_mut(sub)
                .and_then(|set| set.reasons.remove(&id))
        };
        if self.projects_source(sub) {
            let next = self.source_rows(sub, engine);
            let resulting_reason = if reveal { "revealed" } else { "hidden" };
            if !next
                .iter()
                .any(|row| row["key"] == key && row[resulting_reason].is_object())
            {
                if let Some(prior) = previous_choice {
                    self.reveals
                        .entry(sub.into())
                        .or_default()
                        .reasons
                        .insert(id, prior);
                } else if let Some(set) = self.reveals.get_mut(sub) {
                    set.reasons.remove(&id);
                }
                return Err("not-found");
            }
            let previous = self.delivered.insert(sub.into(), next).unwrap_or_default();
            return Ok(super::output_diff::diff(&previous, &self.delivered[sub]));
        }
        let account = self
            .queries
            .get(sub)
            .and_then(|query| query.account.as_deref());
        let next = if reveal {
            self.revealed_note(engine, account, &event, reason, current)
        } else {
            let mut value = note::covered(current.clone(), reason);
            if let Some(detail) = crate::engine::query_hidden::detail(
                &engine.store,
                account,
                &event,
                reason,
                &engine.private_lists,
            ) {
                value["hidden"]["detail"] = json!(detail);
            }
            value
        };
        if let Some(rows) = self.delivered.get_mut(sub) {
            rows[index] = next.clone();
        }
        Ok(vec![json!({"op":"update","row":next})])
    }
}
