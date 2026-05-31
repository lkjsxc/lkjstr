use crate::{
    CustomEmoji, KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE, NostrEvent, NostrTag,
    custom_emoji_tag_parts, reply_parent, reply_root, tag_values,
};

pub struct ZapRequestInput<'a> {
    pub event: Option<&'a NostrEvent>,
    pub profile_pubkey: Option<&'a str>,
    pub recipient_pubkey: Option<&'a str>,
    pub amount_msats: u64,
    pub lnurl: &'a str,
    pub relays: &'a [String],
}

pub fn reply_tags(event: &NostrEvent) -> Vec<NostrTag> {
    let root = reply_root(event).unwrap_or_else(|| event.id.to_owned());
    let mut tags = vec![vec![
        "e".to_owned(),
        root.to_owned(),
        String::new(),
        "root".to_owned(),
    ]];
    if root != event.id {
        tags.push(vec![
            "e".to_owned(),
            event.id.to_owned(),
            String::new(),
            "reply".to_owned(),
        ]);
    } else {
        tags[0] = vec![
            "e".to_owned(),
            event.id.to_owned(),
            String::new(),
            "root".to_owned(),
        ];
    }
    for pubkey in unique_pubkeys(event) {
        tags.push(vec!["p".to_owned(), pubkey]);
    }
    tags
}

pub fn reaction_tags(event: &NostrEvent, emoji: Option<&CustomEmoji>) -> Vec<NostrTag> {
    let mut tags = vec![
        vec!["e".to_owned(), event.id.to_owned()],
        vec!["p".to_owned(), event.pubkey.to_owned()],
        vec!["k".to_owned(), event.kind.to_string()],
    ];
    if let Some(value) = emoji {
        tags.push(custom_emoji_tag_parts(value));
    }
    tags
}

pub fn repost_tags(event: &NostrEvent) -> Vec<NostrTag> {
    let mut tags = vec![
        vec!["e".to_owned(), event.id.to_owned()],
        vec!["p".to_owned(), event.pubkey.to_owned()],
    ];
    if event.kind != KIND_TEXT_NOTE {
        tags.push(vec!["k".to_owned(), event.kind.to_string()]);
    }
    tags
}

pub fn repost_kind(event: &NostrEvent) -> u64 {
    if event.kind == KIND_TEXT_NOTE {
        KIND_REPOST
    } else {
        KIND_GENERIC_REPOST
    }
}

pub fn zap_request_tags(input: &ZapRequestInput<'_>) -> Vec<NostrTag> {
    let mut tags = vec![
        relay_tag(input.relays),
        vec!["amount".to_owned(), input.amount_msats.to_string()],
        vec!["lnurl".to_owned(), input.lnurl.to_owned()],
    ];
    if let Some(event) = input.event {
        tags.push(vec!["e".to_owned(), event.id.to_owned()]);
        tags.push(vec![
            "p".to_owned(),
            input.recipient_pubkey.unwrap_or(&event.pubkey).to_owned(),
        ]);
        tags.push(vec!["k".to_owned(), event.kind.to_string()]);
    } else if let Some(pubkey) = input.profile_pubkey {
        tags.push(vec!["p".to_owned(), pubkey.to_owned()]);
    }
    tags
}

pub fn parent_event_id(event: &NostrEvent) -> String {
    reply_parent(event).unwrap_or_else(|| event.id.to_owned())
}

fn unique_pubkeys(event: &NostrEvent) -> Vec<String> {
    let mut pubkeys = vec![event.pubkey.to_owned()];
    for pubkey in tag_values(event, "p") {
        if !pubkeys.contains(&pubkey) {
            pubkeys.push(pubkey);
        }
    }
    pubkeys
}

fn relay_tag(relays: &[String]) -> NostrTag {
    let mut tag = vec!["relays".to_owned()];
    tag.extend(relays.iter().cloned());
    tag
}
