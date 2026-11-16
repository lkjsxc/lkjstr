use super::*;
use crate::engine::Engine;
use serde_json::Value;
impl Session {
    pub fn failure(req: String, code: &str) -> Output {
        let mapped = match code {
            "list-not-loaded" | "target-unavailable" => "not-found",
            "signer-rejected" => "signer-refused",
            "signer-timeout" => "signer-missing",
            "event-too-large" => "too-large",
            "invalid-account" => "signed-out",
            "no-relays" => "no-relays",
            "invalid-relay" | "invalid-server" => "rejected",
            "signed-out" | "read-only" | "signer-refused" | "signer-missing" | "rejected"
            | "too-large" | "offline" | "not-found" => code,
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
                super::quote_state::settle(&mut row, engine);
                row
            })
            .collect()
    }
}
