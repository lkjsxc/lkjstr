use super::{
    FeedEventContent, FeedEventContentRow, FeedEventProfileMention, plan_feed_event_content,
};
use crate::feed_fragments::{FeedFragmentConfig, SemanticFeedEvent};
use lkjstr_protocol::{ProfilePointer, encode_nprofile, encode_npub};

#[test]
fn content_rows_render_npub_profile_mentions() -> Result<(), String> {
    let pubkey = "1".repeat(64);
    let npub = encode_npub(&pubkey).map_err(|error| format!("{error:?}"))?;
    let raw = format!("nostr:{npub}");
    let content = plan_feed_event_content(
        false,
        None,
        &event(&format!("hi {raw}!")),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("hi ".to_owned()),
            profile_mention(&pubkey, &raw, Vec::new()),
            FeedEventContentRow::Text("!".to_owned()),
        ]
    );
    Ok(())
}

#[test]
fn content_rows_render_nprofile_relay_hints() -> Result<(), String> {
    let pubkey = "2".repeat(64);
    let nprofile = encode_nprofile(&ProfilePointer {
        pubkey: pubkey.clone(),
        relays: Some(vec!["wss://relay.example".to_owned()]),
    })
    .map_err(|error| format!("{error:?}"))?;
    let raw = format!("nostr:{nprofile}");
    let content = plan_feed_event_content(
        false,
        None,
        &event(&raw),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![profile_mention(
            &pubkey,
            &raw,
            vec!["wss://relay.example".to_owned()],
        )]
    );
    Ok(())
}

fn content_rows(content: FeedEventContent) -> Vec<FeedEventContentRow> {
    match content {
        FeedEventContent::Sensitive { rows, .. } | FeedEventContent::Rows(rows) => rows,
    }
}

fn event(content: &str) -> SemanticFeedEvent {
    SemanticFeedEvent {
        event_id: "event".to_owned(),
        event_kind: 1,
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

fn profile_mention(pubkey: &str, raw: &str, relays: Vec<String>) -> FeedEventContentRow {
    FeedEventContentRow::ProfileMention(FeedEventProfileMention {
        pubkey: pubkey.to_owned(),
        relays,
        raw_text: raw.to_owned(),
    })
}
