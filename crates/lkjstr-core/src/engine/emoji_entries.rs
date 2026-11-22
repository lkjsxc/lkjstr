//! Bounded picker identities and provenance from the incoming event's own tags.
use super::{MAX_CODE, MAX_IDENTIFIER, MAX_ROWS, MAX_TAGS, MAX_URL};
use crate::store::Store;
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::NostrEvent;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub(crate) struct Entry {
    pub source: String,
    pub code: String,
    pub url: String,
    pub set: String,
    pub address: Option<String>,
}
impl Entry {
    pub fn key(&self) -> String {
        let hash = lkjstr_protocol::bytes_to_hex(&Sha256::digest(self.url.as_bytes()));
        format!("emoji:{}:{}:{hash}", self.source, self.code)
    }
}
pub(super) fn entries(event: &NostrEvent, set: &str) -> Vec<Entry> {
    let mut result = Vec::<Entry>::new();
    let mut positions = BTreeMap::<(String, String), usize>::new();
    let set_address = lkjstr_protocol::emoji_set_address(event);
    let source = set_address
        .clone()
        .unwrap_or_else(|| format!("10030:{}:", event.pubkey));
    for tag in event.tags.iter().take(MAX_TAGS) {
        if tag.get(1).is_none_or(|v| v.len() > MAX_CODE)
            || tag.get(2).is_none_or(|v| v.len() > MAX_URL)
        {
            continue;
        }
        let Some(emoji) = lkjstr_protocol::custom_emoji_tag(tag) else {
            continue;
        };
        let identity = (emoji.shortcode.clone(), emoji.url.clone());
        let address = set_address.clone().or_else(|| {
            emoji
                .address
                .filter(|address| address.len() <= 6 + 64 + 1 + MAX_IDENTIFIER)
        });
        if let Some(index) = positions.get(&identity) {
            result[*index].address = address;
        } else if result.len() < MAX_ROWS {
            positions.insert(identity, result.len());
            result.push(Entry {
                source: source.clone(),
                code: emoji.shortcode,
                url: emoji.url,
                set: set.into(),
                address,
            });
        }
    }
    result
}
pub(crate) fn label(event: &NostrEvent, fallback: &str) -> String {
    let title = event
        .tags
        .iter()
        .take(MAX_TAGS)
        .find(|tag| tag.first().is_some_and(|key| key == "title"))
        .and_then(|tag| tag.get(1))
        .filter(|value| !value.is_empty())
        .map_or(fallback, String::as_str);
    let mut end = title.len().min(256);
    while !title.is_char_boundary(end) {
        end -= 1;
    }
    title[..end].to_owned()
}
/// No reverse lookup by shortcode or URL, and no discovery authority.
pub(crate) fn details(
    store: &Store,
    event: &NostrEvent,
    code: &str,
    url: &str,
) -> (Option<String>, Option<String>) {
    let address = event
        .tags
        .iter()
        .rev()
        .filter_map(|tag| lkjstr_protocol::custom_emoji_tag(tag))
        .find(|emoji| emoji.shortcode == code && emoji.url == url)
        .and_then(|emoji| emoji.address)
        .filter(|address| address.len() <= 6 + 64 + 1 + MAX_IDENTIFIER);
    let set = address.as_deref().and_then(|address| {
        let coordinate = Coordinate::parse(address).ok()?;
        if coordinate.kind != 30030 {
            return None;
        }
        let event = store.addressed(&coordinate)?;
        let holds_picture = event
            .tags
            .iter()
            .take(MAX_TAGS)
            .filter_map(|tag| lkjstr_protocol::custom_emoji_tag(tag))
            .any(|emoji| emoji.url == url);
        holds_picture.then(|| label(&event, &coordinate.identifier))
    });
    (address, set)
}

pub(crate) fn reactions(
    store: &Store,
    id: &str,
    account: Option<&str>,
) -> Vec<crate::engine::rows::Reaction> {
    use crate::engine::rows::Reaction;
    let mut reactions: BTreeMap<(String, Option<String>), Reaction> = BTreeMap::new();
    for e in store.reactions(id) {
        let url = crate::reactions::image_url(&e);
        let content = crate::reactions::label(&e.content).to_owned();
        let (address, set) = url
            .as_deref()
            .and_then(|url| {
                let code = lkjstr_protocol::custom_emoji_reaction_shortcode(&e.content)?;
                Some(details(store, &e, &code, url))
            })
            .unwrap_or_default();
        let r = reactions
            .entry((content.clone(), url.clone()))
            .or_insert(Reaction {
                content,
                url,
                address: None,
                set: None,
                count: 0,
                mine: false,
            });
        if r.set.is_none() && (r.address.is_none() || set.is_some()) {
            r.address = address;
            r.set = set;
        }
        r.count += 1;
        r.mine |= account == Some(e.pubkey.as_str());
    }
    reactions.into_values().collect()
}
