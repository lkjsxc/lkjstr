use super::*;
use crate::engine::Engine;
use serde_json::Value;
impl Session {
    /// Cache only observed relay metadata; independent dependencies are projected afresh.
    pub(super) fn relay_state(state: &Value) -> Value {
        let mut base = state.clone();
        if let Some(fields) = base.as_object_mut() {
            fields.remove("privateLists");
            fields.remove("zapEvidence");
        }
        base
    }
    pub fn cancelled(req: String) -> Output {
        let mut result = Self::failure(req, "internal");
        if let Output::Result {
            error, cancelled, ..
        } = &mut result
        {
            *error = None;
            *cancelled = Some(true);
        }
        result
    }
    pub fn failure(req: String, code: &str) -> Output {
        let mapped = match code {
            "list-not-loaded" | "target-unavailable" => "not-found",
            "signer-rejected" => "signer-refused",
            "event-too-large" => "too-large",
            "invalid-account" => "signed-out",
            "no-relays" => "no-relays",
            "invalid-relay" | "invalid-server" => "rejected",
            "signed-out" | "read-only" | "signer-refused" | "signer-missing" | "rejected"
            | "signer-timeout" | "too-large" | "offline" | "not-found" => code,
            "unsupported" | "upload-not-implemented" | "private-list-edit-unsupported" => {
                "unsupported"
            }
            _ => "internal",
        };
        Output::Result {
            req,
            ok: false,
            error: Some(Failure {
                code: mapped.into(),
                message: Some(code.into()),
            }),
            delivery: None,
            id: None,
            uploaded: None,
            key: None,
            encrypted_key: None,
            zap_intent: None,
            dm_draft: None,
            dm_draft_revision: None,
            dm_delivery: None,
            cancelled: None,
        }
    }
    pub(super) fn rows(
        &self,
        sub: &str,
        items: &[crate::engine::rows::Row],
        engine: &Engine,
    ) -> Vec<Value> {
        let q = self.queries.get(sub);
        if q.is_some_and(|q| {
            q.notifications == Some(true)
                || matches!(
                    q.source.as_str(),
                    "people"
                        | "channels"
                        | "channel"
                        | "thread"
                        | "profile"
                        | "followers"
                        | "following"
                        | "mutes"
                        | "list"
                        | "notifications"
                        | "bookmarks"
                        | "relays"
                        | "media-servers"
                        | "emoji"
                )
        }) {
            return self.source_rows(sub, engine);
        }
        items
            .iter()
            .filter(|r| !r.own.muted && !matches!(r.kind, 6 | 16))
            .map(|r| {
                let mut row =
                    super::note::note(r, &engine.store, q.and_then(|q| q.account.as_deref()));
                super::quote_state::settle(&mut row, engine, q.and_then(|q| q.account.as_deref()));
                if let Some(q) = q.filter(|q| q.source == "home") {
                    super::quote_state::home_delivery(&mut row, engine, q.account.as_deref());
                }
                row
            })
            .collect()
    }
}
