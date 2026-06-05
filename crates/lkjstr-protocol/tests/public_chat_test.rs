use lkjstr_protocol::{
    ChannelMetadata, KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE,
    KIND_CHANNEL_METADATA, KIND_CHANNEL_MUTE_USER, KIND_TEXT_NOTE, NostrEvent, PublicChatError,
    channel_message_reply_tags, channel_message_root_tag, channel_reply_event_id,
    channel_root_event_id, hide_message_target, is_public_chat_kind, mute_user_target,
    parse_channel_create_metadata, parse_channel_metadata_update,
};

#[test]
fn exposes_kind_constants() {
    assert_eq!(KIND_CHANNEL_CREATE, 40);
    assert_eq!(KIND_CHANNEL_METADATA, 41);
    assert_eq!(KIND_CHANNEL_MESSAGE, 42);
    assert_eq!(KIND_CHANNEL_HIDE_MESSAGE, 43);
    assert_eq!(KIND_CHANNEL_MUTE_USER, 44);
    assert!(is_public_chat_kind(KIND_CHANNEL_MESSAGE));
    assert!(!is_public_chat_kind(KIND_TEXT_NOTE));
}

#[test]
fn parses_channel_create_metadata() {
    let event = event(
        KIND_CHANNEL_CREATE,
        r#"{"name":"  General  ","about":"Talk","picture":"https://example.test/a.png","relays":["relay.example","wss://relay.example/"]}"#,
        vec![],
    );
    assert_eq!(
        parse_channel_create_metadata(&event),
        Ok(ChannelMetadata {
            name: Some("General".to_owned()),
            about: Some("Talk".to_owned()),
            picture: Some("https://example.test/a.png".to_owned()),
            relays: vec!["wss://relay.example/".to_owned()],
        })
    );
}

#[test]
fn parses_channel_metadata_update() -> Result<(), String> {
    let event = event(
        KIND_CHANNEL_METADATA,
        r#"{"name":"News","unknown":true}"#,
        vec![vec!["e", "channel", "wss://relay.example/", "root"]],
    );
    let parsed = parse_channel_metadata_update(&event).map_err(|error| format!("{error:?}"))?;
    assert_eq!(parsed.channel_id, "channel");
    assert_eq!(parsed.metadata.name.as_deref(), Some("News"));
    assert_eq!(parsed.metadata.about, None);
    Ok(())
}

#[test]
fn rejects_invalid_json_and_kind_mismatch() {
    let bad_json = event(KIND_CHANNEL_CREATE, "{", vec![]);
    assert_eq!(
        parse_channel_create_metadata(&bad_json),
        Err(PublicChatError::InvalidJson)
    );
    let wrong_kind = event(KIND_TEXT_NOTE, "{}", vec![]);
    assert_eq!(
        parse_channel_create_metadata(&wrong_kind),
        Err(PublicChatError::WrongKind {
            expected: KIND_CHANNEL_CREATE,
            actual: KIND_TEXT_NOTE,
        })
    );
}

#[test]
fn rejects_non_object_and_non_string_fields() {
    let array = event(KIND_CHANNEL_CREATE, "[]", vec![]);
    assert!(matches!(
        parse_channel_create_metadata(&array),
        Err(PublicChatError::InvalidMetadata(_))
    ));
    let number_name = event(KIND_CHANNEL_CREATE, r#"{"name":7}"#, vec![]);
    assert!(matches!(
        parse_channel_create_metadata(&number_name),
        Err(PublicChatError::InvalidMetadata(_))
    ));
}

#[test]
fn ignores_non_https_picture_and_bounds_text() -> Result<(), String> {
    let http = event(
        KIND_CHANNEL_CREATE,
        r#"{"picture":"http://example.test/a.png"}"#,
        vec![],
    );
    let parsed = parse_channel_create_metadata(&http).map_err(|error| format!("{error:?}"))?;
    assert_eq!(parsed.picture, None);
    let long_name = format!("{{\"name\":\"{}\"}}", "a".repeat(129));
    assert!(matches!(
        parse_channel_create_metadata(&event(KIND_CHANNEL_CREATE, &long_name, vec![])),
        Err(PublicChatError::FieldTooLong { field: "name", .. })
    ));
    Ok(())
}

#[test]
fn builds_channel_message_tags() {
    assert_eq!(
        channel_message_root_tag("channel", Some("wss://relay.example/")),
        vec!["e", "channel", "wss://relay.example/", "root"]
    );
    assert_eq!(
        channel_message_reply_tags("channel", "root-message", "reply-message", None),
        vec![
            vec!["e", "channel", "", "root"],
            vec!["e", "root-message", "", "root"],
            vec!["e", "reply-message", "", "reply"],
        ]
    );
}

#[test]
fn extracts_channel_and_moderation_targets() {
    let message = event(
        KIND_CHANNEL_MESSAGE,
        "hello",
        vec![
            vec!["e", "channel", "", "root"],
            vec!["e", "reply-message", "", "reply"],
        ],
    );
    assert_eq!(channel_root_event_id(&message), Some("channel"));
    assert_eq!(channel_reply_event_id(&message), Some("reply-message"));
    assert_eq!(
        hide_message_target(&event(
            KIND_CHANNEL_HIDE_MESSAGE,
            "",
            vec![vec!["e", "message"]]
        )),
        Some("message")
    );
    assert_eq!(
        mute_user_target(&event(
            KIND_CHANNEL_MUTE_USER,
            "",
            vec![vec!["p", "pubkey"]]
        )),
        Some("pubkey")
    );
}

fn event(kind: u64, content: &str, tags: Vec<Vec<&str>>) -> NostrEvent {
    NostrEvent {
        id: "0".repeat(64),
        pubkey: "1".repeat(64),
        created_at: 1,
        kind,
        tags: tags
            .into_iter()
            .map(|tag| tag.into_iter().map(str::to_owned).collect())
            .collect(),
        content: content.to_owned(),
        sig: "2".repeat(128),
    }
}
