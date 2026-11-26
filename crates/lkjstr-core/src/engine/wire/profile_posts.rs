//! Keep the displayed event's identity and time, with the selected repost as its reading context.
use super::{Session, note};
use crate::engine::{Engine, acts, protocol::Query, query, rows, visibility};
use serde_json::{Value, json};

pub(super) fn rows(session: &Session, sub: &str, engine: &Engine, query: &Query) -> Vec<Value> {
    query::events_with_repost(&engine.store, query)
        .into_iter()
        .filter_map(|(event, repost)| {
            // A missing target stays in the engine window for lookup without taking a row here.
            if repost.is_none() && acts::is_repost(event.kind) {
                return None;
            }
            let reason = repost.as_ref().and_then(|repost| {
                visibility::reason(&engine.store, query, repost, &engine.private_lists)
            });
            let mut row = session.project_event(sub, engine, query, &event, reason);
            if let Some(fields) = row.as_object_mut() {
                fields.remove("repostedBy");
            }
            if let Some(repost) = repost {
                row["repostedBy"] = json!({
                    "actors": [note::author(&rows::author(&engine.store, &repost.pubkey))],
                    "others": 0,
                    "at": repost.created_at.saturating_mul(1000),
                });
                if let Some(at) = engine.store.expires_at(&repost.id) {
                    let at = at
                        .saturating_mul(1000)
                        .min(row["expiresAt"].as_u64().unwrap_or(u64::MAX));
                    row["expiresAt"] = json!(at);
                }
            }
            Some(row)
        })
        .collect()
}
