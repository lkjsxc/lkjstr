use lkjstr_protocol::KIND_REACTION;

use crate::feed_fragments::{FeedFragmentConfig, SemanticFeedEvent};

use super::{FeedEventContent, FeedEventContentRow, plan_feed_event_content};

#[test]
fn empty_and_plus_reactions_render_as_heart_summary() {
    assert_eq!(reaction_text("+"), vec!["Reacted with ❤️".to_owned()]);
    assert_eq!(reaction_text(""), vec!["Reacted with ❤️".to_owned()]);
}

fn reaction_text(content: &str) -> Vec<String> {
    content_rows(plan_feed_event_content(
        false,
        None,
        &event(content),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    ))
    .into_iter()
    .filter_map(|row| match row {
        FeedEventContentRow::Text(value) => Some(value),
        _ => None,
    })
    .collect()
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event(content: &str) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "event".to_owned(),
        event_kind: KIND_REACTION,
        pubkey: "a".repeat(64),
        created_at: 1,
        content: content.to_owned(),
        media_attachments: Vec::new(),
        event_references: Vec::new(),
        media_count: 0,
        reference_count: 0,
        relay_provenance: Vec::new(),
        has_action_bar: false,
    }
}
