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
            fields.remove("unshown");
            fields.remove("pins");
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
            "stale-list" | "list-edit-pending" => code,
            "invalid-relay"
            | "invalid-server"
            | "invalid-profile"
            | "profile-edit-pending"
            | "stale-profile" => "rejected",
            "signed-out" | "read-only" | "signer-refused" | "signer-missing" | "rejected"
            | "signer-timeout" | "too-large" | "offline" | "not-found" | "cancelled" => code,
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
            client_info: None,
            cancelled: None,
        }
    }
    pub fn client_info(answer: crate::engine::client_info::Answer) -> Output {
        let Some(handler) = answer.handler else {
            return Self::failure(answer.req, "not-found");
        };
        Output::Result {
            req: answer.req,
            ok: true,
            error: None,
            delivery: None,
            id: None,
            uploaded: None,
            key: None,
            encrypted_key: None,
            zap_intent: None,
            client_info: Some(handler),
            dm_draft: None,
            dm_draft_revision: None,
            dm_delivery: None,
            cancelled: None,
        }
    }
    pub(super) fn projects_source(&self, sub: &str) -> bool {
        self.queries.get(sub).is_some_and(|q| {
            q.notifications == Some(true)
                || matches!(
                    q.source.as_str(),
                    "people"
                        | "channels"
                        | "channel"
                        | "thread"
                        | "profile"
                        | "relay"
                        | "followers"
                        | "following"
                        | "mutes"
                        | "list"
                        | "notifications"
                        | "bookmarks"
                        | "pins"
                        | "relays"
                        | "media-servers"
                        | "emoji"
                )
        })
    }
    pub(super) fn rows(
        &self,
        sub: &str,
        items: &[crate::engine::rows::Row],
        engine: &Engine,
    ) -> Vec<Value> {
        let q = self.queries.get(sub);
        if self.projects_source(sub) {
            return self.source_rows(sub, engine);
        }
        items
            .iter()
            .filter(|r| {
                !matches!(r.kind, 6 | 16)
                    || (r.kind == 6
                        && r.hidden_reason.is_some()
                        && q.is_some_and(|q| q.source == "their-home"))
            })
            .map(|r| {
                let mut row = self.project_note(sub, engine, r);
                super::quote_state::settle(&mut row, engine, q.and_then(|q| q.account.as_deref()));
                if let Some(q) = q.filter(|q| q.source == "home") {
                    super::quote_state::home_delivery(&mut row, engine, q.account.as_deref());
                }
                row
            })
            .collect()
    }
}

// Pure wire constructors used by the Worker and the native ownership fixture.
// No client ID or browser handle is encoded in a transport message.
impl Output {
    pub fn extension_sign(
        req: String,
        event: &lkjstr_protocol::UnsignedNostrEvent,
        action_req: Option<&str>,
        work: crate::engine::signer_orchestration::SignerWork,
        expires_at: u64,
    ) -> Self {
        Self::Sign {
            req,
            pubkey: event.pubkey.clone(),
            event: serde_json::to_string(event).unwrap_or_default(),
            action_req: action_req.map(str::to_owned),
            expires_at: Some(expires_at),
            weight: work.weight(),
        }
    }
}

pub struct ExtensionCrypt<'a> {
    pub account: &'a str,
    pub peer: &'a str,
    pub operation: &'a str,
    pub data: &'a str,
    pub read: bool,
    pub passive: bool,
    pub context: Option<CryptContext>,
}
impl ExtensionCrypt<'_> {
    pub fn output(self, req: String, expires_at: u64) -> Output {
        use crate::engine::signer_orchestration::SignerWork;
        let background = self.read && self.passive;
        let work = match (self.context.is_some(), self.read, background) {
            (true, _, _) => SignerWork::LazyList,
            (_, true, true) => SignerWork::Background,
            (_, true, false) => SignerWork::Visible,
            _ => SignerWork::UserAction,
        };
        Output::Crypt {
            req,
            expires_at: Some(expires_at),
            pubkey: self.account.into(),
            peer: self.peer.into(),
            operation: self.operation.into(),
            data: self.data.into(),
            background,
            weight: work.weight(),
            context: self.context,
        }
    }
}
