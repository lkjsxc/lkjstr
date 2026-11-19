//! Resolve embedded placeholders when finite reference requests have settled.
use super::*;
use crate::engine::Engine;
use serde_json::Value;
pub(super) fn settle(row: &mut Value, e: &Engine, account: Option<&str>) {
    super::counts::settle(row, e, account);
    super::acts::settle(row, e);
    if row["kind"] == "profile"
        && let Some(p) = row["author"]["pubkey"].as_str().map(str::to_owned)
    {
        super::counts::profile(row, e, &p);
    }
    if let Some(quotes) = row.get_mut("quotes").and_then(Value::as_array_mut) {
        for quote in quotes {
            if quote["state"] == "loading"
                && quote["id"]
                    .as_str()
                    .is_some_and(|id| e.network.lookup_failed(id))
            {
                quote["state"] = Value::String("error".into());
            }
            if quote["state"] == "loading"
                && quote["id"]
                    .as_str()
                    .is_some_and(|id| e.network.lookup_complete(id))
            {
                quote["state"] = Value::String("missing".into());
            }
        }
    }
    if let Some(note) = row.get_mut("note") {
        settle(note, e, account);
    }
}

pub(super) fn home_delivery(row: &mut Value, e: &Engine, account: Option<&str>) {
    if row["kind"] == "note" && row["author"]["pubkey"].as_str() == account {
        if row["id"]
            .as_str()
            .is_some_and(|id| e.network.pending_event(id))
        {
            row["pending"] = Value::Bool(true);
            if row["id"]
                .as_str()
                .is_some_and(|id| e.network.connecting_event(id))
            {
                row["connecting"] = Value::Bool(true);
            } else if let Some(fields) = row.as_object_mut() {
                fields.remove("connecting");
            }
        } else if let Some(fields) = row.as_object_mut() {
            fields.remove("pending");
            fields.remove("connecting");
        }
    }
}

impl Session {
    pub(super) fn settled_quote_patch(&mut self, sub: &str, e: &Engine) -> Vec<Value> {
        let query = self.queries.get(sub);
        let account = query.and_then(|q| q.account.as_deref());
        let Some(rows) = self.delivered.get_mut(sub) else {
            return vec![];
        };
        let mut ops = Vec::new();
        for row in rows {
            let before = row.clone();
            settle(row, e, account);
            if query.is_some_and(|q| q.source == "home") {
                home_delivery(row, e, account);
            }
            if before != *row {
                ops.push(serde_json::json!({"op":"update","row":row}));
            }
        }
        ops
    }
}
