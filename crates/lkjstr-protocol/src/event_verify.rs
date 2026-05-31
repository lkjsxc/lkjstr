use crate::{NostrEvent, UnsignedNostrEvent, compute_event_id, verify_schnorr_hex};

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum VerificationCode {
    IdMismatch,
    BadSignature,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum VerificationResult {
    Ok(NostrEvent),
    Err {
        code: VerificationCode,
        message: String,
    },
}

pub fn verify_event(event: &NostrEvent) -> VerificationResult {
    let unsigned = UnsignedNostrEvent {
        pubkey: event.pubkey.clone(),
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags.clone(),
        content: event.content.clone(),
    };
    let Ok(id) = compute_event_id(&unsigned) else {
        return VerificationResult::Err {
            code: VerificationCode::IdMismatch,
            message: "event id does not match payload".to_owned(),
        };
    };
    if id != event.id {
        return VerificationResult::Err {
            code: VerificationCode::IdMismatch,
            message: "event id does not match payload".to_owned(),
        };
    }
    if !verify_schnorr_hex(&event.sig, &event.id, &event.pubkey) {
        return VerificationResult::Err {
            code: VerificationCode::BadSignature,
            message: "event signature is invalid".to_owned(),
        };
    }
    VerificationResult::Ok(event.clone())
}
