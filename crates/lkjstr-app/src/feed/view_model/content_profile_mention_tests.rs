use super::{
    FeedEventContent, FeedEventContentRow, FeedEventProfileMention, plan_feed_event_content,
};
use crate::feed_fragments::{FeedFragmentConfig, SemanticFeedEvent};
use lkjstr_protocol::{ProfilePointer, encode_nprofile, encode_npub};

#[test]
fn content_rows_render_npub_profile_mentions() -> Result<(), String> {
    let pubkey = "1".repeat(64);
    let second_pubkey = "3".repeat(64);
    let npub = encode_npub(&pubkey).map_err(|error| format!("{error:?}"))?;
    let second_npub = encode_npub(&second_pubkey).map_err(|error| format!("{error:?}"))?;
    let raw = format!("nostr:{npub}");
    let second_raw = format!("nostr:{second_npub}");
    let content = plan_feed_event_content(
        false,
        None,
        &event(&format!("hi {raw} and {second_raw}!")),
        &[],
        "shape",
        120,
        &FeedFragmentConfig::default(),
    );

    assert_eq!(
        content_rows(content),
        vec![
            FeedEventContentRow::Text("hi ".to_owned()),
            profile_mention(0, &pubkey, &raw, Vec::new()),
            FeedEventContentRow::Text(" and ".to_owned()),
            profile_mention(1, &second_pubkey, &second_raw, Vec::new()),
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
        relays: Some(vec![
            "relay.example".to_owned(),
            "https://relay.example/".to_owned(),
        ]),
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
            0,
            &pubkey,
            &raw,
            vec!["wss://relay.example/".to_owned()],
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

fn profile_mention(
    index: u16,
    pubkey: &str,
    raw: &str,
    relays: Vec<String>,
) -> FeedEventContentRow {
    FeedEventContentRow::ProfileMention(FeedEventProfileMention {
        row_key: format!("event:event:shape:shape:kind:event-profile-mention:index:{index}"),
        item_index: index,
        pubkey: pubkey.to_owned(),
        relays,
        raw_text: raw.to_owned(),
    })
}
