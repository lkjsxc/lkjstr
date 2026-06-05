use lkjstr_domain::{
    PublicChatPublishState, PublishRelayResult, apply_own_hide_events, apply_own_mute_events,
    empty_public_chat_state, mark_publish_queued, merge_channel_create, merge_channel_messages,
    merge_channel_metadata, merge_publish_result, reset_on_tab_close, select_channel,
    set_composer_text,
};
use lkjstr_protocol::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER, NostrEvent,
};

#[test]
fn merges_channels_and_metadata_newest_first() {
    let first = event(
        "b",
        "creator",
        10,
        KIND_CHANNEL_CREATE,
        r#"{"name":"Beta"}"#,
        vec![],
    );
    let second = event(
        "a",
        "creator",
        20,
        KIND_CHANNEL_CREATE,
        r#"{"name":"Alpha"}"#,
        vec![],
    );
    let mut state = merge_channel_create(empty_public_chat_state(), &first);
    state = merge_channel_create(state, &second);
    assert_eq!(channel_ids(&state.channels), vec!["a", "b"]);

    let metadata = event(
        "m",
        "creator",
        30,
        KIND_CHANNEL_METADATA,
        r#"{"name":"Beta updated","relays":["relay.example"]}"#,
        vec![vec!["e", "b", "", "root"]],
    );
    state = merge_channel_metadata(state, &metadata);
    assert_eq!(channel_ids(&state.channels), vec!["b", "a"]);
    assert_eq!(
        state.channels[0].metadata.name.as_deref(),
        Some("Beta updated")
    );
    assert_eq!(state.channels[0].relay_hints, vec!["wss://relay.example/"]);
}

#[test]
fn selects_channel_and_merges_messages_in_chat_order() {
    let channel = event("c", "creator", 1, KIND_CHANNEL_CREATE, "{}", vec![]);
    let state = merge_channel_create(empty_public_chat_state(), &channel);
    let state = select_channel(state, Some("c".to_owned()));
    assert_eq!(state.selected_channel_id.as_deref(), Some("c"));

    let later = message("z", "alice", 30, "c", "late");
    let earlier = message("a", "bob", 20, "c", "early");
    let relays = vec!["wss://relay.example/".to_owned()];
    let state = merge_channel_messages(state, &[later, earlier], &relays);
    assert_eq!(
        state
            .messages
            .iter()
            .map(|item| item.content.as_str())
            .collect::<Vec<_>>(),
        vec!["early", "late"]
    );
    assert_eq!(state.channels[0].last_message_at, Some(30));
}

#[test]
fn signed_hide_and_mute_events_compact_messages() {
    let state = merge_channel_messages(
        empty_public_chat_state(),
        &[message("m", "muted", 2, "c", "secret")],
        &[],
    );
    let hide = event(
        "h",
        "me",
        3,
        KIND_CHANNEL_HIDE_MESSAGE,
        "",
        vec![vec!["e", "m"]],
    );
    let mute = event(
        "u",
        "me",
        4,
        KIND_CHANNEL_MUTE_USER,
        "",
        vec![vec!["p", "muted"]],
    );
    let state = apply_own_hide_events(state, &[hide]);
    let state = apply_own_mute_events(state, &[mute]);
    assert!(state.messages[0].hidden);
    assert!(state.messages[0].muted_author);
}

#[test]
fn composer_and_publish_state_are_pure() {
    let state = set_composer_text(empty_public_chat_state(), "hello");
    assert_eq!(state.composer_draft, "hello");
    let state = mark_publish_queued(state, "event".to_owned());
    assert_eq!(state.composer_draft, "");
    assert_eq!(
        state.publish,
        PublicChatPublishState::Queued {
            event_id: "event".to_owned()
        }
    );
    let state = merge_publish_result(
        state,
        "event".to_owned(),
        PublishRelayResult {
            succeeded: vec!["wss://ok/".to_owned()],
            failed: vec!["wss://fail/".to_owned()],
        },
    );
    assert!(matches!(
        state.publish,
        PublicChatPublishState::Partial { .. }
    ));
    assert_eq!(reset_on_tab_close(), empty_public_chat_state());
}

fn channel_ids(channels: &[lkjstr_domain::PublicChatChannel]) -> Vec<&str> {
    channels.iter().map(|channel| channel.id.as_str()).collect()
}

fn message(id: &str, pubkey: &str, created_at: u64, channel_id: &str, content: &str) -> NostrEvent {
    event(
        id,
        pubkey,
        created_at,
        KIND_CHANNEL_MESSAGE,
        content,
        vec![vec!["e", channel_id, "", "root"]],
    )
}

fn event(
    id: &str,
    pubkey: &str,
    created_at: u64,
    kind: u64,
    content: &str,
    tags: Vec<Vec<&str>>,
) -> NostrEvent {
    NostrEvent {
        id: id.to_owned(),
        pubkey: pubkey.to_owned(),
        created_at,
        kind,
        tags: tags
            .into_iter()
            .map(|tag| tag.into_iter().map(str::to_owned).collect())
            .collect(),
        content: content.to_owned(),
        sig: "sig".to_owned(),
    }
}
