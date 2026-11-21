use super::{Output, Session};
use lkjstr_protocol::{NostrEntity, decode_nip19};

impl Session {
    pub fn check_link(req: String, route: &str, reference: &str) -> Output {
        let valid = match (route, decode_nip19(reference)) {
            ("n", Some(NostrEntity::Note(_))) => true,
            ("n", Some(NostrEntity::Nevent(pointer))) => pointer
                .kind
                .is_none_or(|kind| matches!(kind, 1 | 42 | 30023)),
            ("p", Some(NostrEntity::Npub(_) | NostrEntity::Nprofile(_))) => true,
            ("a", Some(NostrEntity::Naddr(pointer))) => pointer.kind == 30023,
            _ => false,
        };
        if !valid {
            return Self::failure(req, "rejected");
        }
        Output::Result {
            req,
            ok: true,
            error: None,
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
}
