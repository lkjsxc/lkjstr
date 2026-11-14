//! Publication guards shared by pointer and keyboard UI paths.
use lkjstr_protocol::{
    NostrEvent, UnsignedNostrEvent, VerificationResult, reply_tags, verify_event,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NoteAction {
    Open,
    Profile,
    Reply,
    Like,
}

pub fn note_action(key: &str, modified: bool) -> Option<NoteAction> {
    if modified {
        return None;
    }
    Some(match key {
        "Enter" | "o" => NoteAction::Open,
        "p" => NoteAction::Profile,
        "r" => NoteAction::Reply,
        "l" => NoteAction::Like,
        _ => return None,
    })
}

/// A missing reply parent must never silently become a top-level publication.
pub fn compose_tags(
    reply_to: Option<&str>,
    parent: Option<&NostrEvent>,
) -> Result<Vec<Vec<String>>, &'static str> {
    match reply_to {
        None => Ok(vec![]),
        Some(id) => parent
            .filter(|p| p.id == id)
            .map(reply_tags)
            .ok_or("The reply parent is unavailable. Wait for it to load before replying."),
    }
}

/// An external signer may only sign the exact event requested by this account.
pub fn validate_signed_event(
    requested: &UnsignedNostrEvent,
    signed: &NostrEvent,
) -> Result<(), &'static str> {
    if requested.pubkey != signed.pubkey
        || requested.created_at != signed.created_at
        || requested.kind != signed.kind
        || requested.tags != signed.tags
        || requested.content != signed.content
    {
        return Err("The signer changed the requested event or account.");
    }
    if !matches!(verify_event(signed), VerificationResult::Ok(_)) {
        return Err("The signer returned an invalid event ID or signature.");
    }
    Ok(())
}
