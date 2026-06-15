use crate::{NostrEntity, decode_nip19, event_reference_scan::nostr_entity_spans, is_pubkey};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentProfileMention {
    pub pubkey: String,
    pub relays: Vec<String>,
    pub raw: String,
    pub start: usize,
    pub end: usize,
}

#[must_use]
pub fn content_profile_mentions(content: &str) -> Vec<ContentProfileMention> {
    nostr_entity_spans(content)
        .into_iter()
        .filter_map(|span| profile_mention(content, span))
        .collect()
}

fn profile_mention(
    content: &str,
    span: crate::event_reference_scan::NostrEntitySpan,
) -> Option<ContentProfileMention> {
    match decode_nip19(&span.entity) {
        Some(NostrEntity::Npub(pubkey)) if is_pubkey(&pubkey) => {
            Some(mention(content, pubkey, Vec::new(), span.start, span.end))
        }
        Some(NostrEntity::Nprofile(pointer)) if is_pubkey(&pointer.pubkey) => Some(mention(
            content,
            pointer.pubkey,
            pointer.relays.unwrap_or_default(),
            span.start,
            span.end,
        )),
        _ => None,
    }
}

fn mention(
    content: &str,
    pubkey: String,
    relays: Vec<String>,
    start: usize,
    end: usize,
) -> ContentProfileMention {
    ContentProfileMention {
        pubkey,
        relays,
        raw: content[start..end].to_owned(),
        start,
        end,
    }
}
