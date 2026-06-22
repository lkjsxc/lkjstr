use lkjstr_app::public_chat::{
    PublicChatDemandContext, PublicChatQueryInput, channel_discovery_query_input,
    channel_metadata_query_input, own_hide_query_input, selected_channel_messages_query_input,
};
use lkjstr_app::{QuerySurface, plan_query_demand};
use lkjstr_protocol::{KIND_CHANNEL_CREATE, KIND_CHANNEL_MESSAGE, KIND_CHANNEL_METADATA};
use lkjstr_relays::{DemandPhase, DemandPurpose, DemandSurface, DemandVisibility};

#[test]
fn channel_discovery_uses_shared_public_chat_demand_surface() {
    let mut input = base_input();
    input.disabled_relays = vec!["wss://disabled.example/".to_owned()];
    let query = channel_discovery_query_input(context(), &input);
    assert_eq!(query.surface, QuerySurface::PublicChat);
    assert_eq!(query.purpose, DemandPurpose::Feed);
    assert_eq!(query.filters[0].kinds, Some(vec![KIND_CHANNEL_CREATE]));
    let plan = plan_query_demand(query);
    assert_eq!(plan.demand.surface, DemandSurface::PublicChat);
    assert_eq!(plan.demand.relays, vec!["wss://a/", "wss://hint/"]);
}

#[test]
fn selected_messages_keep_channel_identity_in_demand() {
    let mut input = base_input();
    input.selected_channel_id = Some("channel-event".to_owned());
    let query = selected_channel_messages_query_input(context(), &input).unwrap();
    assert_eq!(query.channel, Some("channel-event".to_owned()));
    assert_eq!(query.filters[0].kinds, Some(vec![KIND_CHANNEL_MESSAGE]));
    assert_eq!(
        query.filters[0].tags.get("e"),
        Some(&vec!["channel-event".to_owned()])
    );
}

#[test]
fn metadata_and_moderation_demands_have_exact_filters() {
    let mut input = base_input();
    input.channel_ids = vec!["channel-a".to_owned()];
    input.active_pubkey = Some("me".to_owned());
    input.loaded_message_ids = vec!["message-a".to_owned()];
    let metadata = channel_metadata_query_input(context(), &input).unwrap();
    assert_eq!(metadata.purpose, DemandPurpose::Metadata);
    assert_eq!(metadata.filters[0].kinds, Some(vec![KIND_CHANNEL_METADATA]));
    let hide = own_hide_query_input(context(), &input).unwrap();
    assert_eq!(hide.purpose, DemandPurpose::EventLookup);
    assert_eq!(hide.filters[0].authors, Some(vec!["me".to_owned()]));
    assert_eq!(
        hide.filters[0].tags.get("e"),
        Some(&vec!["message-a".to_owned()])
    );
}

fn context() -> PublicChatDemandContext {
    PublicChatDemandContext {
        owner: "public-chat-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        phase: DemandPhase::Bootstrap,
        now_sec: 100,
    }
}

fn base_input() -> PublicChatQueryInput {
    let mut input = PublicChatQueryInput::with_selected_read_relays(vec![
        "wss://a/".to_owned(),
        "wss://disabled.example/".to_owned(),
    ]);
    input.relay_hints = vec!["wss://hint/".to_owned()];
    input
}
