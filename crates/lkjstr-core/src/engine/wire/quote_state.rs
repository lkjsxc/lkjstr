//! Resolve embedded placeholders when finite reference requests have settled.
use super::*;
use crate::engine::Engine;
use serde_json::Value;
pub(super) fn settle(row: &mut Value, e: &Engine, account: Option<&str>) {
    if row["hidden"].is_object() {
        return;
    }
    if row["replyTo"]["id"].as_str().is_some_and(|id| {
        e.store
            .get(id)
            .is_none_or(|parent| super::visibility::nested_hidden(e, account, &parent))
    }) && let Some(fields) = row.as_object_mut()
    {
        fields.remove("replyTo");
    }
    super::counts::settle(row, e, account);
    super::acts::settle(row, e, account);
    if row["kind"] == "profile"
        && let Some(p) = row["author"]["pubkey"].as_str().map(str::to_owned)
    {
        super::counts::profile(row, e, &p);
    }
    if let Some(quotes) = row.get_mut("quotes").and_then(Value::as_array_mut) {
        for quote in quotes {
            let Some(id) = quote["id"].as_str() else {
                continue;
            };
            let state = if e.store.verified_deleted(id) {
                "deleted"
            } else if e.store.verified_expired(id) {
                "expired"
            } else if e
                .store
                .get(id)
                .is_some_and(|event| super::visibility::nested_hidden(e, account, &event))
            {
                "muted"
            } else if quote["state"] == "loading" && e.network.lookup_failed(id) {
                "error"
            } else if quote["state"] == "loading" && e.network.lookup_complete(id) {
                "missing"
            } else {
                continue;
            };
            *quote = serde_json::json!({"id": id, "state": state});
        }
    }
    if let Some(note) = row.get_mut("note") {
        settle(note, e, account);
    }
    let earliest = [row["replyTo"]["id"].as_str(), row["target"]["id"].as_str()]
        .into_iter()
        .flatten()
        .chain(
            row["quotes"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|quote| quote["state"] == "ok")
                .filter_map(|quote| quote["id"].as_str()),
        )
        .filter_map(|id| e.store.expires_at(id).map(|at| at.saturating_mul(1000)))
        .chain(row["expiresAt"].as_u64())
        .chain(row["note"]["expiresAt"].as_u64())
        .min();
    if let Some(at) = earliest {
        row["expiresAt"] = serde_json::json!(at);
    }
}

pub(super) fn home_delivery(row: &mut Value, e: &Engine, account: Option<&str>) {
    if row["kind"] == "note"
        && !row["hidden"].is_object()
        && row["author"]["pubkey"].as_str() == account
    {
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
