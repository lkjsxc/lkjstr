use lkjstr_app::{
    PublicChatQueryInput, channel_discovery_plan, channel_message_template, channel_metadata_plan,
    channel_reply_template, create_channel_template, hide_message_template, mute_user_template,
    own_hide_plan, own_mute_plan, route_relays, selected_channel_messages_plan,
    update_channel_metadata_template,
};
use lkjstr_domain::PublicChatMetadata;
use lkjstr_protocol::{
    KIND_CHANNEL_CREATE, KIND_CHANNEL_HIDE_MESSAGE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA,
    KIND_CHANNEL_MUTE_USER,
};

#[test]
fn plans_channel_discovery_on_selected_read_relays() {
    let input = PublicChatQueryInput::with_selected_read_relays(vec!["wss://a/".to_owned()]);
    let plan = channel_discovery_plan(&input);
    assert_eq!(plan.demand_key, "public-chat:channels:wss://a/");
    assert_eq!(plan.relays, vec!["wss://a/"]);
    assert_eq!(plan.filters[0].kinds, Some(vec![KIND_CHANNEL_CREATE]));
    assert_eq!(plan.filters[0].limit, Some(50));
}

#[test]
fn bounds_and_dedupes_relay_hints() {
    let mut input = PublicChatQueryInput::with_selected_read_relays(vec!["wss://a/".to_owned()]);
    input.relay_hints = vec![
        "wss://a/".to_owned(),
        "wss://b/".to_owned(),
        "wss://c/".to_owned(),
    ];
    input.max_hint_relays = 1;
    assert_eq!(route_relays(&input), vec!["wss://a/", "wss://b/"]);
}

#[test]
fn plans_metadata_and_message_filters() -> Result<(), String> {
    let mut input = PublicChatQueryInput::with_selected_read_relays(vec!["wss://a/".to_owned()]);
    input.channel_ids = vec!["channel".to_owned()];
    input.selected_channel_id = Some("channel".to_owned());
    input.limit = 25;
    let metadata = channel_metadata_plan(&input).ok_or("missing metadata plan")?;
    assert_eq!(metadata.filters[0].kinds, Some(vec![KIND_CHANNEL_METADATA]));
    assert_eq!(
        metadata.filters[0].tags.get("e"),
        Some(&vec!["channel".to_owned()])
    );
    let messages = selected_channel_messages_plan(&input).ok_or("missing message plan")?;
    assert_eq!(messages.filters[0].kinds, Some(vec![KIND_CHANNEL_MESSAGE]));
    assert_eq!(messages.filters[0].limit, Some(25));
    Ok(())
}

#[test]
fn plans_own_moderation_filters() -> Result<(), String> {
    let mut input = PublicChatQueryInput::with_selected_read_relays(vec!["wss://a/".to_owned()]);
    input.active_pubkey = Some("me".to_owned());
    input.loaded_message_ids = vec!["m".to_owned()];
    input.loaded_author_pubkeys = vec!["author".to_owned()];
    let hide = own_hide_plan(&input).ok_or("missing hide plan")?;
    assert_eq!(hide.filters[0].authors, Some(vec!["me".to_owned()]));
    assert_eq!(hide.filters[0].kinds, Some(vec![KIND_CHANNEL_HIDE_MESSAGE]));
    assert_eq!(hide.filters[0].tags.get("e"), Some(&vec!["m".to_owned()]));
    let mute = own_mute_plan(&input).ok_or("missing mute plan")?;
    assert_eq!(mute.filters[0].kinds, Some(vec![KIND_CHANNEL_MUTE_USER]));
    assert_eq!(
        mute.filters[0].tags.get("p"),
        Some(&vec!["author".to_owned()])
    );
    Ok(())
}

#[test]
fn builds_publish_templates() -> Result<(), String> {
    let metadata = PublicChatMetadata {
        name: Some("General".to_owned()),
        about: None,
        picture: None,
        relays: vec!["wss://a/".to_owned()],
    };
    assert_eq!(
        create_channel_template(&metadata)
            .map_err(|error| error.to_string())?
            .kind,
        KIND_CHANNEL_CREATE
    );
    assert_eq!(
        update_channel_metadata_template("channel", &metadata, None)
            .map_err(|error| error.to_string())?
            .kind,
        KIND_CHANNEL_METADATA
    );
    assert_eq!(
        channel_message_template("channel", "hi", None).kind,
        KIND_CHANNEL_MESSAGE
    );
    assert_eq!(
        channel_reply_template("channel", "root", "reply", "hi", None)
            .tags
            .len(),
        3
    );
    assert_eq!(
        hide_message_template("message", "reason").kind,
        KIND_CHANNEL_HIDE_MESSAGE
    );
    assert_eq!(
        mute_user_template("pubkey", "reason").kind,
        KIND_CHANNEL_MUTE_USER
    );
    Ok(())
}
