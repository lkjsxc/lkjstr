use serde::{Deserialize, Serialize};

use crate::{CustomEmoji, NostrEvent, custom_emoji_tag, custom_emoji_token_text};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum ReactionKind {
    Like,
    Dislike,
    Emoji,
    CustomEmoji,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct ParsedReaction {
    pub kind: ReactionKind,
    pub display: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emoji: Option<CustomEmoji>,
}

pub fn reaction_target_event_id(event: &NostrEvent) -> Option<String> {
    event
        .tags
        .iter()
        .rev()
        .find(|tag| {
            tag.first().is_some_and(|name| name == "e")
                && tag.get(1).is_some_and(|value| !value.is_empty())
        })
        .and_then(|tag| tag.get(1))
        .cloned()
}

pub fn parse_reaction(event: &NostrEvent) -> ParsedReaction {
    let content = reaction_content(&event.content);
    if content == "+" {
        return parsed(ReactionKind::Like, "heart", None);
    }
    if content == "-" {
        return parsed(ReactionKind::Dislike, "-", None);
    }
    if let Some(emoji) = custom_emoji_reaction(event, &content) {
        return parsed(ReactionKind::CustomEmoji, &content, Some(emoji));
    }
    parsed(ReactionKind::Emoji, &content, None)
}

pub fn reaction_content(content: &str) -> String {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        "+".to_owned()
    } else {
        trimmed.to_owned()
    }
}

pub fn custom_emoji_reaction(event: &NostrEvent, content: &str) -> Option<CustomEmoji> {
    let shortcode = custom_emoji_reaction_shortcode(content)?;
    event
        .tags
        .iter()
        .filter_map(|tag| custom_emoji_tag(tag))
        .find(|emoji| emoji.shortcode == shortcode)
}

pub fn custom_emoji_reaction_shortcode(content: &str) -> Option<String> {
    let inner = content.strip_prefix(':')?.strip_suffix(':')?;
    if crate::valid_incoming_custom_emoji_shortcode(inner) {
        Some(inner.to_owned())
    } else {
        None
    }
}

pub fn custom_emoji_reaction_content(emoji: &CustomEmoji) -> String {
    custom_emoji_token_text(&emoji.shortcode)
}

fn parsed(kind: ReactionKind, display: &str, emoji: Option<CustomEmoji>) -> ParsedReaction {
    ParsedReaction {
        kind,
        display: display.to_owned(),
        emoji,
    }
}
