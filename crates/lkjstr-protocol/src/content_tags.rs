use crate::{
    CustomEmoji, NostrEntity, NostrTag, custom_emoji_tag_parts, custom_emoji_token_text,
    decode_nip19, is_event_id, is_pubkey,
};

pub fn content_derived_tags(
    content: &str,
    emojis: &[CustomEmoji],
    base_tags: &[NostrTag],
) -> Vec<NostrTag> {
    let mut tags = base_tags.to_vec();
    for tag in mention_tags(content) {
        append_unique(&mut tags, tag);
    }
    for tag in emoji_tags(content, emojis) {
        append_unique(&mut tags, tag);
    }
    tags
}

pub fn mention_tags(content: &str) -> Vec<NostrTag> {
    let mut tags = Vec::new();
    for entity in nostr_entities(content) {
        match decode_nip19(&entity) {
            Some(NostrEntity::Npub(pubkey)) if is_pubkey(&pubkey) => {
                tags.push(vec!["p".to_owned(), pubkey]);
            }
            Some(NostrEntity::Nprofile(pointer)) if is_pubkey(&pointer.pubkey) => {
                tags.push(relayed_tag("p", &pointer.pubkey, pointer.relays.as_deref()));
            }
            Some(NostrEntity::Note(id)) if is_event_id(&id) => {
                tags.push(vec!["q".to_owned(), id]);
            }
            Some(NostrEntity::Nevent(pointer)) if is_event_id(&pointer.id) => {
                tags.push(relayed_tag("q", &pointer.id, pointer.relays.as_deref()));
            }
            _ => {}
        }
    }
    tags
}

pub fn emoji_tags(content: &str, emojis: &[CustomEmoji]) -> Vec<NostrTag> {
    let mut unique = Vec::<CustomEmoji>::new();
    for emoji in emojis {
        if let Some(existing) = unique
            .iter_mut()
            .find(|item| item.shortcode == emoji.shortcode)
        {
            *existing = emoji.clone();
        } else {
            unique.push(emoji.clone());
        }
    }
    unique
        .iter()
        .filter(|emoji| content.contains(&custom_emoji_token_text(&emoji.shortcode)))
        .map(custom_emoji_tag_parts)
        .collect()
}

fn nostr_entities(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut items = Vec::new();
    let mut index = 0;
    while index + 6 <= bytes.len() {
        if starts_nostr_at(bytes, index) && is_word_boundary(bytes, index) {
            let start = index + 6;
            let mut end = start;
            while end < bytes.len() && bytes[end].is_ascii_alphanumeric() {
                end += 1;
            }
            if end > start {
                items.push(content[start..end].to_owned());
            }
            index = end;
        } else {
            index += 1;
        }
    }
    items
}

fn relayed_tag(name: &str, id: &str, relays: Option<&[String]>) -> NostrTag {
    vec![
        name.to_owned(),
        id.to_owned(),
        relays
            .and_then(|items| items.first())
            .cloned()
            .unwrap_or_default(),
    ]
}

fn append_unique(tags: &mut Vec<NostrTag>, tag: NostrTag) {
    let key = tag_key(&tag);
    if let Some(index) = tags.iter().position(|item| tag_key(item) == key) {
        if tags[index].get(2).is_none_or(String::is_empty)
            && tag.get(2).is_some_and(|value| !value.is_empty())
        {
            tags[index] = tag;
        }
    } else {
        tags.push(tag);
    }
}

fn tag_key(tag: &[String]) -> String {
    format!(
        "{}\u{0}{}",
        tag.first().map_or("", String::as_str),
        tag.get(1).map_or("", String::as_str)
    )
}

fn starts_nostr_at(bytes: &[u8], index: usize) -> bool {
    bytes[index..].len() >= 6 && bytes[index..index + 6].eq_ignore_ascii_case(b"nostr:")
}

fn is_word_boundary(bytes: &[u8], index: usize) -> bool {
    index == 0 || !is_ascii_word(bytes[index - 1])
}

fn is_ascii_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}
