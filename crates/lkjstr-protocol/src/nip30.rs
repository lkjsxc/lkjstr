use serde::{Deserialize, Serialize};
use url::Url;

use crate::{NostrEvent, NostrTag, is_pubkey};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct CustomEmoji {
    pub shortcode: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
}

pub fn custom_emojis(event: &NostrEvent) -> Vec<CustomEmoji> {
    let mut emojis = Vec::new();
    for tag in &event.tags {
        if let Some(emoji) = custom_emoji_tag(tag) {
            upsert_emoji(&mut emojis, emoji);
        }
    }
    emojis
}

pub fn custom_emoji_tag(tag: &[String]) -> Option<CustomEmoji> {
    let name = tag.first()?;
    let shortcode = tag.get(1)?;
    let url = tag.get(2)?;
    if name != "emoji" || !valid_incoming_custom_emoji_shortcode(shortcode) {
        return None;
    }
    if !valid_custom_emoji_url(url) {
        return None;
    }
    Some(CustomEmoji {
        shortcode: shortcode.to_owned(),
        url: url.to_owned(),
        address: tag
            .get(3)
            .filter(|value| valid_custom_emoji_address(value))
            .cloned(),
    })
}

pub fn valid_custom_emoji_shortcode(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

pub fn valid_incoming_custom_emoji_shortcode(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

pub fn valid_custom_emoji_url(value: &str) -> bool {
    Url::parse(value).is_ok_and(|url| url.scheme() == "https")
}

pub fn valid_custom_emoji_address(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("30030:") else {
        return false;
    };
    let Some((pubkey, identifier)) = rest.split_once(':') else {
        return false;
    };
    is_pubkey(pubkey) && valid_address_identifier(identifier)
}

pub fn custom_emoji_token_text(shortcode: &str) -> String {
    format!(":{shortcode}:")
}

pub fn parse_custom_emoji_input(value: &str) -> Option<CustomEmoji> {
    let trimmed = value.trim();
    let remainder = trimmed.strip_prefix(':')?;
    let (shortcode, url_and_address) = remainder.split_once(':')?;
    if !valid_custom_emoji_shortcode(shortcode) || url_and_address.chars().any(char::is_whitespace)
    {
        return None;
    }
    let (url, address) = split_url_address(url_and_address);
    if !valid_custom_emoji_url(url) {
        return None;
    }
    Some(CustomEmoji {
        shortcode: shortcode.to_owned(),
        url: url.to_owned(),
        address,
    })
}

pub fn custom_emoji_tag_parts(emoji: &CustomEmoji) -> NostrTag {
    let mut tag = vec![
        "emoji".to_owned(),
        emoji.shortcode.to_owned(),
        emoji.url.to_owned(),
    ];
    if let Some(address) = &emoji.address {
        tag.push(address.to_owned());
    }
    tag
}

fn upsert_emoji(emojis: &mut Vec<CustomEmoji>, emoji: CustomEmoji) {
    if let Some(existing) = emojis
        .iter_mut()
        .find(|item| item.shortcode == emoji.shortcode)
    {
        *existing = emoji;
    } else {
        emojis.push(emoji);
    }
}

fn split_url_address(value: &str) -> (&str, Option<String>) {
    let Some((url, suffix)) = value.rsplit_once(":30030:") else {
        return (value, None);
    };
    let candidate = format!("30030:{suffix}");
    if valid_custom_emoji_address(&candidate) {
        (url, Some(candidate))
    } else {
        (value, None)
    }
}

fn valid_address_identifier(value: &str) -> bool {
    !value.is_empty()
        && !value
            .chars()
            .any(|item| item.is_whitespace() || item == ':')
}
