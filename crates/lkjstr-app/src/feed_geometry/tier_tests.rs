use super::hash::MaterializationTier;
use super::*;
use lkjstr_protocol::NostrEvent;

fn event(content: String, tags: Vec<Vec<String>>) -> NostrEvent {
    NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 42,
        kind: 1,
        tags,
        content,
        sig: "c".repeat(128),
    }
}

#[test]
fn counts_quote_reference_tags() {
    let tags = vec![
        vec!["e".to_owned(), "a".repeat(64)],
        vec!["q".to_owned(), "b".repeat(64)],
    ];
    let features = event_geometry_features(
        &event("hello".to_owned(), tags),
        RowKind::Event,
        640,
        1.0,
        false,
        true,
        MaterializationTier::Structural,
    );

    assert_eq!(features.reference_preview_count, 2);
}

#[test]
fn enriched_reference_previews_estimate_higher_than_structural() {
    let tags = vec![vec!["e".to_owned(), "a".repeat(64)]];
    let structural = event_geometry_features(
        &event("hello".to_owned(), tags.clone()),
        RowKind::Event,
        640,
        1.0,
        false,
        true,
        MaterializationTier::Structural,
    );
    let enriched = event_geometry_features(
        &event("hello".to_owned(), tags),
        RowKind::Event,
        640,
        1.0,
        false,
        true,
        MaterializationTier::Enriched,
    );

    let structural_estimate = estimate_row_geometry("structural", &structural, &[]);
    let enriched_estimate = estimate_row_geometry("enriched", &enriched, &[]);
    assert!(enriched_estimate.estimated_height_px > structural_estimate.estimated_height_px);
}
