use super::*;

fn event(content: String) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "a".repeat(64),
        event_kind: 1,
        pubkey: "b".repeat(64),
        created_at: 42,
        content,
        media_attachments: Vec::new(),
        event_references: Vec::new(),
        media_count: 0,
        reference_count: 0,
        relay_provenance: vec!["wss://relay.example".to_owned()],
        has_action_bar: true,
    }
}

#[test]
fn normal_note_produces_one_visual_row() {
    let rows = plan_feed_visual_rows(&event("short".to_owned()), "shape", 120, &default_config());

    assert_eq!(rows.len(), 1);
    assert!(matches!(rows[0], FeedVisualRow::EventFull(_)));
}

#[test]
fn oversized_note_produces_real_text_segments() {
    let content = "alpha beta\n\n".repeat(260);
    let rows = plan_feed_visual_rows(&event(content.clone()), "shape", 3_000, &default_config());
    let joined = joined_text(&rows);

    assert!(rows.len() > 2);
    assert!(matches!(rows[0], FeedVisualRow::EventHeader(_)));
    assert_eq!(joined, content);
    assert!(matches!(rows.last(), Some(FeedVisualRow::EventActions(_))));
}

#[test]
fn long_token_is_preserved_exactly() {
    let content = "x".repeat(5_000);
    let rows = plan_feed_visual_rows(&event(content.clone()), "shape", 4_000, &default_config());

    assert_eq!(joined_text(&rows), content);
}

#[test]
fn keys_are_stable_and_shape_sensitive() {
    let base = event("x".repeat(3_000));
    let rows_a = plan_feed_visual_rows(&base, "shape-a", 4_000, &default_config());
    let rows_b = plan_feed_visual_rows(&base, "shape-a", 4_000, &default_config());
    let rows_c = plan_feed_visual_rows(&base, "shape-b", 4_000, &default_config());

    assert_eq!(row_keys(&rows_a), row_keys(&rows_b));
    assert_ne!(row_keys(&rows_a), row_keys(&rows_c));
}

#[test]
fn media_reference_and_action_fragments_preserve_order() {
    let mut semantic = event("text".repeat(800));
    semantic.media_count = 5;
    semantic.reference_count = 2;
    let rows = plan_feed_visual_rows(&semantic, "shape", 3_000, &default_config());
    let kinds: Vec<&'static str> = rows.iter().map(kind_name).collect();

    assert_eq!(kinds.first(), Some(&"header"));
    assert!(kinds.windows(2).any(|window| window == ["media", "media"]));
    assert!(kinds.contains(&"reference"));
    assert_eq!(kinds.last(), Some(&"actions"));
}

#[test]
fn text_segment_boundaries_are_valid_unicode() {
    let content = "😀 paragraph\n\n".repeat(300);
    let rows = plan_feed_visual_rows(&event(content.clone()), "shape", 4_000, &default_config());

    for row in rows {
        if let FeedVisualRow::EventTextSegment(segment) = row {
            assert!(content.is_char_boundary(segment.starts_at));
            assert!(content.is_char_boundary(segment.ends_at));
            assert_eq!(&content[segment.starts_at..segment.ends_at], segment.text);
        }
    }
}

fn default_config() -> FeedFragmentConfig {
    FeedFragmentConfig::default()
}

fn joined_text(rows: &[FeedVisualRow]) -> String {
    rows.iter()
        .filter_map(|row| match row {
            FeedVisualRow::EventTextSegment(segment) => Some(segment.text.as_str()),
            _ => None,
        })
        .collect()
}

fn row_keys(rows: &[FeedVisualRow]) -> Vec<String> {
    rows.iter().map(|row| row.row_key().to_owned()).collect()
}

fn kind_name(row: &FeedVisualRow) -> &'static str {
    match row {
        FeedVisualRow::EventFull(_) => "full",
        FeedVisualRow::EventHeader(_) => "header",
        FeedVisualRow::EventTextSegment(_) => "text",
        FeedVisualRow::EventMediaSegment(_) => "media",
        FeedVisualRow::EventReferenceSegment(_) => "reference",
        FeedVisualRow::EventActions(_) => "actions",
    }
}
