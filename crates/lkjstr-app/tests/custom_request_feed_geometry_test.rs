use lkjstr_app::{
    CustomRequestFeedSourceState, CustomRequestFeedViewInput, CustomRequestRunInput,
    EventDisplayContext, FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags,
    GeometryEstimateSource, RowGeometryModel, build_custom_request_feed_view, empty_feed_window,
    feed_event_geometry_model_keys, plan_custom_request_run, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn custom_request_view_uses_exact_geometry_model() -> Result<(), String> {
    let window = window_with_event();
    let keys =
        feed_event_geometry_model_keys(&window, EventDisplayContext::CustomRequest, 680, 1.0);
    let model = build_custom_request_feed_view(CustomRequestFeedViewInput {
        owner: "custom-tab".to_owned(),
        run_plan: Some(ready_plan()),
        source_state: CustomRequestFeedSourceState::Complete,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: vec![RowGeometryModel {
            bucket_key: keys
                .first()
                .cloned()
                .ok_or_else(|| "expected geometry key".to_owned())?,
            average_height_px: 533,
            sample_count: 9,
            updated_at_ms: 12,
        }],
        fragment_config: FeedFragmentConfig::default(),
    });
    let Some(FeedViewRow::Event(row)) = model.view_model.rows.first() else {
        return Err("expected event row".to_owned());
    };
    assert_eq!(row.geometry_estimate.estimated_height_px, 533);
    assert_eq!(
        row.geometry_estimate.source,
        GeometryEstimateSource::ExactKey
    );
    Ok(())
}

fn ready_plan() -> lkjstr_app::CustomRequestRunPlan {
    plan_custom_request_run(CustomRequestRunInput {
        owner: "custom-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        raw_json: r#"{"kinds":[1],"limit":30}"#.to_owned(),
        now_sec: 1_700_000_030,
        page_size: 30,
    })
}

fn window_with_event() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![ProgressiveEvent {
                relays: vec!["wss://selected.example".to_owned()],
                sub_id: "custom-request".to_owned(),
                event: NostrEvent {
                    id: format!("{:064x}", 1),
                    pubkey: "a".repeat(64),
                    created_at: 1_700_000_001,
                    kind: KIND_TEXT_NOTE,
                    tags: Vec::new(),
                    content: "real custom request event".to_owned(),
                    sig: "b".repeat(128),
                },
            }],
            flags: FeedWindowFlags::default(),
        },
    )
}
