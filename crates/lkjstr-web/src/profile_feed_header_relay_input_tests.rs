use super::*;
use lkjstr_app::{
    EventDisplayContext, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, GeometryEstimateSource,
    ProfileFeedSourceState, RowGeometryModel, empty_feed_window, feed_event_geometry_model_keys,
    reduce_feed_window,
};
use lkjstr_relays::ProgressiveEvent;

#[test]
fn header_relay_routes_filters() -> Result<(), &'static str> {
    let input = relay_input(&empty_feed_window(1, 180), &[])?;

    assert_eq!(
        input.relays,
        vec!["wss://author.example", "wss://selected.example"]
    );
    assert_eq!(
        filter_kinds(&input, "wss://author.example"),
        vec![KIND_METADATA, KIND_RELAY_LIST_METADATA]
    );
    assert_eq!(
        filter_kinds(&input, "wss://selected.example"),
        vec![KIND_FOLLOW_LIST]
    );
    Ok(())
}

#[test]
fn header_model_reuses_geometry_models() -> Result<(), &'static str> {
    let window = reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive_note()],
            flags: FeedWindowFlags::default(),
        },
    );
    let key = feed_event_geometry_model_keys(&window, EventDisplayContext::Profile, 680, 1.0)
        .pop()
        .ok_or("missing geometry key")?;
    let models = vec![RowGeometryModel {
        bucket_key: key,
        average_height_px: 333,
        sample_count: 7,
        updated_at_ms: 10,
    }];
    let input = relay_input(&window, &models)?;
    let model = profile_header_model(&input, None, Vec::new());
    let Some(FeedViewRow::Event(row)) = model.view_model.rows.first() else {
        return Err("expected event row");
    };
    assert_eq!(row.geometry_estimate.estimated_height_px, 333);
    assert_eq!(row.geometry_estimate.source, GeometryEstimateSource::ExactKey);
    Ok(())
}

fn relay_input(
    window: &lkjstr_app::FeedWindowState,
    geometry_models: &[RowGeometryModel],
) -> Result<ProfileHeaderRelayReadInput, &'static str> {
    profile_header_relay_input(ProfileHeaderRelayInputSeed {
        owner: "profile-tab",
        profile_pubkey: &Some("a".repeat(64)),
        selected_relays: &["wss://selected.example".to_owned()],
        view_selected_relays: &[],
        relay_sets_json: "[]",
        author_routes: &[route("wss://author.example")],
        profile_header: &None,
        window,
        geometry_models,
        source_state: &ProfileFeedSourceState::Pending,
        read_plan: &read_plan(),
        diagnostics: &[],
        now_sec: 10,
    })
    .ok_or("expected relay input")
}

fn read_plan() -> EffectiveReadRelays {
    EffectiveReadRelays::from_durable_settings(vec!["wss://selected.example".to_owned()])
}

fn filter_kinds(input: &ProfileHeaderRelayReadInput, relay: &str) -> Vec<u64> {
    profile_header_relay_filters(input, relay)
        .into_iter()
        .flat_map(|filter| filter.kinds.unwrap_or_default())
        .collect()
}

fn progressive_note() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "profile-header".to_owned(),
        event: NostrEvent {
            id: "9".repeat(64),
            pubkey: "a".repeat(64),
            created_at: 9,
            kind: lkjstr_protocol::KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "profile note".to_owned(),
            sig: "f".repeat(128),
        },
    }
}

fn route(relay_url: &str) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author: "a".repeat(64),
        relay_url: relay_url.to_owned(),
        source: lkjstr_relays::RouteEvidenceSource::Nip65,
        score: 0,
    }
}
