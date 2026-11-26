use super::{Output, Session};
use crate::store::Store;
use lkjstr_protocol::{NostrEntity, NostrEvent, decode_nip19};

pub(super) fn share_event(event: &NostrEvent, store: &Store) -> Option<String> {
    if !crate::kinds::policy(event.kind).openable {
        return None;
    }
    let relays = store
        .seen_on(&event.id)
        .into_iter()
        .filter_map(|url| crate::engine::settings::strict_relay(&url))
        .filter(|url| url.len() <= usize::from(u8::MAX))
        .take(3)
        .collect();
    super::generic_face::event_reference(event, Some(relays))
}

impl Session {
    pub fn check_link(req: String, route: &str, reference: &str) -> Output {
        let valid = match (route, decode_nip19(reference)) {
            ("n", Some(NostrEntity::Note(_))) => true,
            ("n", Some(NostrEntity::Nevent(pointer))) => pointer
                .kind
                .is_none_or(|kind| crate::kinds::policy(kind).openable),
            ("p", Some(NostrEntity::Npub(_) | NostrEntity::Nprofile(_))) => true,
            ("a", Some(NostrEntity::Naddr(pointer))) => {
                crate::kinds::policy(pointer.kind).openable
                    && lkjstr_nips::address::Coordinate::parse(&format!(
                        "{}:{}:{}",
                        pointer.kind, pointer.pubkey, pointer.identifier
                    ))
                    .is_ok()
            }
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
