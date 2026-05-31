use lkjstr_protocol::{
    CustomEmoji, NostrEvent, ParsedReaction, ReactionKind, custom_emoji_reaction_content,
    custom_emoji_reaction_shortcode, first_tag_value, index_tags, parse_reaction, reaction_content,
    reaction_target_event_id, reply_parent, reply_root,
};

#[test]
fn extracts_indexed_tags_and_reply_markers() {
    let event = event_with_tags(vec![
        tag(&["e", &"1".repeat(64), "wss://relay.example", "root"]),
        tag(&["e", &"2".repeat(64), "wss://relay.example", "reply"]),
        tag(&["p", &"3".repeat(64)]),
        tag(&["t", "workspace"]),
        tag(&["r", "wss://relay.example"]),
        tag(&["e", ""]),
    ]);
    let indexed = index_tags(&event);
    assert_eq!(indexed.events, vec!["1".repeat(64), "2".repeat(64)]);
    assert_eq!(indexed.pubkeys, vec!["3".repeat(64)]);
    assert_eq!(indexed.topics, vec!["workspace".to_owned()]);
    assert_eq!(indexed.relays, vec!["wss://relay.example".to_owned()]);
    assert_eq!(reply_root(&event), Some("1".repeat(64)));
    assert_eq!(reply_parent(&event), Some("2".repeat(64)));
    assert_eq!(first_tag_value(&event, "missing"), None);
}

#[test]
fn falls_back_to_unmarked_reply_positions() {
    let event = event_with_tags(vec![tag(&["e", "root"]), tag(&["e", "parent"])]);
    assert_eq!(reply_root(&event), Some("root".to_owned()));
    assert_eq!(reply_parent(&event), Some("parent".to_owned()));
}

#[test]
fn parses_reaction_content_and_targets() {
    let like = reaction("+", vec![tag(&["e", "root"]), tag(&["e", "target"])]);
    assert_eq!(reaction_target_event_id(&like), Some("target".to_owned()));
    assert_eq!(
        parse_reaction(&like),
        ParsedReaction {
            kind: ReactionKind::Like,
            display: "heart".to_owned(),
            emoji: None,
        }
    );
    assert_eq!(reaction_content("  "), "+");
    assert_eq!(
        parse_reaction(&reaction("-", Vec::new())).kind,
        ReactionKind::Dislike
    );
}

#[test]
fn parses_custom_emoji_reactions() {
    let event = reaction(
        " :party-1: ",
        vec![tag(&["emoji", "party-1", "https://x/party.png"])],
    );
    assert_eq!(
        custom_emoji_reaction_shortcode(":party-1:"),
        Some("party-1".to_owned())
    );
    assert_eq!(parse_reaction(&event).kind, ReactionKind::CustomEmoji);
    assert_eq!(
        custom_emoji_reaction_content(&CustomEmoji {
            shortcode: "party".to_owned(),
            url: "https://x/party.png".to_owned(),
            address: None,
        }),
        ":party:"
    );
}

fn reaction(content: &str, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        content: content.to_owned(),
        tags,
        ..event_with_tags(Vec::new())
    }
}

fn event_with_tags(tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "0".repeat(64),
        pubkey: "f".repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content: String::new(),
        sig: "a".repeat(128),
    }
}

fn tag(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}
