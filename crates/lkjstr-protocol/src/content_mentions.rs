use crate::{
    NostrEntity, decode_nip19, event_reference_scan::nostr_entity_spans, is_pubkey,
    normalize_relay_url,
};

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

/// Byte spans for standalone NIP-19 profile tokens that need canonical NIP-21 text.
#[must_use]
pub fn canonical_profile_replacements(content: &str) -> Vec<(usize, usize, String)> {
    let mut offset = 0;
    content
        .split_inclusive(char::is_whitespace)
        .filter_map(|token| {
            let start_of_token = offset;
            offset += token.len();
            let opened = token.trim_start_matches(['(', '<', '\'', '"']);
            let raw = opened.trim_end_matches(|ch: char| {
                ch.is_whitespace()
                    || matches!(
                        ch,
                        ')' | '>' | '\'' | '"' | '.' | ',' | ';' | ':' | '!' | '?'
                    )
            });
            let entity = match raw.get(..6) {
                Some(prefix) if prefix.eq_ignore_ascii_case("nostr:") => &raw[6..],
                _ => raw,
            };
            if !["npub1", "nprofile1"].iter().any(|prefix| {
                entity
                    .get(..prefix.len())
                    .is_some_and(|start| start.eq_ignore_ascii_case(prefix))
            }) || !matches!(
                decode_nip19(entity),
                Some(NostrEntity::Npub(_) | NostrEntity::Nprofile(_))
            ) {
                return None;
            }
            let reference = format!("nostr:{}", entity.to_ascii_lowercase());
            let start = start_of_token + token.len() - opened.len();
            (raw != reference).then_some((start, start + raw.len(), reference))
        })
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
            normalized_relays(pointer.relays.unwrap_or_default()),
            span.start,
            span.end,
        )),
        _ => None,
    }
}

fn normalized_relays(relays: Vec<String>) -> Vec<String> {
    let mut relays = relays
        .iter()
        .filter_map(|relay| normalize_relay_url(relay))
        .collect::<Vec<_>>();
    relays.sort();
    relays.dedup();
    relays
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
