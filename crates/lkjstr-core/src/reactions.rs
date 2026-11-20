//! Reaction display groups, bounded by the store's retained event collection.
use crate::store::Event;
use lkjstr_protocol::{
    NostrEvent, ReactionKind, custom_emoji_reaction_shortcode, custom_emoji_tag, parse_reaction,
};
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Chip {
    pub content: String,
    pub label: String,
    pub url: Option<String>,
    pub count: usize,
    pub own: Option<String>,
}

pub fn label(content: &str) -> &str {
    match content {
        "+" | "" | "❤" => "❤️",
        "-" => "👎",
        other => other,
    }
}

pub(crate) fn image_url(event: &NostrEvent) -> Option<String> {
    let code = custom_emoji_reaction_shortcode(&event.content)?;
    event
        .tags
        .iter()
        .rev()
        .filter(|tag| tag.get(1) == Some(&code))
        .find_map(|tag| custom_emoji_tag(tag).map(|emoji| emoji.url))
}

pub fn chips(events: &[Event], me: Option<&str>) -> Vec<Chip> {
    let mut groups = BTreeMap::new();
    for event in events.iter().filter(|e| e.kind == 7) {
        let reaction = parse_reaction(event);
        let url = reaction.emoji.map(|emoji| emoji.url);
        let label = if reaction.kind == ReactionKind::Like {
            "❤️".to_owned()
        } else {
            reaction.display
        };
        let key = (label.clone(), url.clone());
        let chip = groups.entry(key).or_insert_with(|| Chip {
            content: event.content.clone(),
            label,
            url,
            count: 0,
            own: None,
        });
        chip.count += 1;
        if me == Some(event.pubkey.as_str()) {
            chip.own = Some(event.id.clone());
        }
    }
    groups.into_values().collect()
}
