use lkjstr_app::{
    EventDisplayContext, FeedFooterState, FeedFragmentConfig, FeedViewModelInput, FeedViewRow,
    FeedWindowEvidence, FeedWindowFlags, GeometryEstimateSource, RowGeometryModel,
    build_feed_view_model, empty_feed_window, feed_event_geometry_model_keys, feed_event_row_id,
    footer_row, reduce_feed_window,
};
use lkjstr_protocol::NostrEvent;
use lkjstr_relays::ProgressiveEvent;

#[test]
fn visible_event_geometry_key_selects_exact_model_estimate() -> Result<(), String> {
    let window = window(vec![progressive(1), progressive(2)]);
    let keys = feed_event_geometry_model_keys(&window, EventDisplayContext::Timeline, 680, 1.0);
    assert_eq!(keys.len(), 1);
    let model = build_feed_view_model(input(
        window,
        vec![RowGeometryModel {
            bucket_key: keys[0].clone(),
            average_height_px: 444,
            sample_count: 8,
            updated_at_ms: 12,
        }],
    ));
    let FeedViewRow::Event(row) = &model.rows[0] else {
        return Err("expected first event row".to_owned());
    };
    assert_eq!(row.row_id, feed_event_row_id(&id(2)));
    assert_eq!(row.geometry_estimate.estimated_height_px, 444);
    assert_eq!(
        row.geometry_estimate.source,
        GeometryEstimateSource::ExactKey
    );
    Ok(())
}

#[test]
fn visible_event_geometry_keys_skip_empty_windows() {
    let keys = feed_event_geometry_model_keys(
        &empty_feed_window(1, 10),
        EventDisplayContext::Timeline,
        680,
        1.0,
    );
    assert!(keys.is_empty());
}

fn input(
    window: lkjstr_app::FeedWindowState,
    geometry_models: Vec<RowGeometryModel>,
) -> FeedViewModelInput {
    FeedViewModelInput {
        feed_id: "home".to_owned(),
        display_context: EventDisplayContext::Timeline,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        state_rows: Vec::new(),
        footer: footer_row("home", FeedFooterState::CacheHit),
    }
}

fn window(events: Vec<ProgressiveEvent>) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 10),
        FeedWindowEvidence::Events {
            generation: 1,
            events,
            flags: FeedWindowFlags::default(),
        },
    )
}

fn progressive(value: u64) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://relay.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_000 + value,
            kind: 1,
            tags: Vec::new(),
            content: "same shape".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
