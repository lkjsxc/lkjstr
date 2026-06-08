use super::*;
use lkjstr_protocol::{NostrEvent, kinds::KIND_REPOST};

fn event(kind: u64, content: String) -> NostrEvent {
    NostrEvent {
        id: "a".repeat(64),
        pubkey: "b".repeat(64),
        created_at: 42,
        kind,
        tags: vec![vec!["e".to_owned(), "d".repeat(64)]],
        content,
        sig: "c".repeat(128),
    }
}

#[test]
fn repost_geometry_uses_compact_rendered_summary_text() {
    let content = format!("{{\"content\":\"{}\"}}", "x".repeat(20_000));
    let repost = event_geometry_features(
        &event(KIND_REPOST, content.clone()),
        RowKind::Event,
        640,
        1.0,
        false,
        true,
        MaterializationTier::Structural,
    );
    let note = event_geometry_features(
        &event(1, content),
        RowKind::Event,
        640,
        1.0,
        false,
        true,
        MaterializationTier::Structural,
    );

    assert_eq!(repost.content_length, "reposted".len() as u32);
    assert!(
        estimate_row_geometry("repost", &repost, &[]).estimated_height_px
            < estimate_row_geometry("note", &note, &[]).estimated_height_px
    );
}
