//! Publication guards shared by pointer and keyboard UI paths.
use lkjstr_protocol::{NostrEvent, reply_tags};

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
