use lkjstr_app::{
    CustomRequestError, CustomRequestErrorKind, CustomRequestFeedSourceState,
    CustomRequestFeedStatus, CustomRequestFeedViewInput, CustomRequestRunInput,
    CustomRequestRunPlan, CustomRequestRunStatus, EventDisplayContext, FeedFooterState,
    FeedFragmentConfig, FeedViewRow, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel,
    build_custom_request_feed_view, canceled_custom_request_feed_view, empty_feed_window,
    plan_custom_request_run, reduce_feed_window, unavailable_custom_request_feed_view,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};

#[test]
fn custom_request_ready_view_uses_real_feed_rows() -> Result<(), String> {
    let model = build_custom_request_feed_view(input(Some(ready_plan()), window_with_event()));

    assert_eq!(model.status, CustomRequestFeedStatus::Ready);
    assert!(model.demand.is_some());
    assert_eq!(model.relays, planned_relays());
    let Some(FeedViewRow::Event(row)) = model.view_model.rows.first() else {
        return Err("expected first event row".to_owned());
    };
    assert_eq!(row.event_id, id(1));
    assert_eq!(row.display.context, EventDisplayContext::CustomRequest);
    assert!(matches!(
        model.view_model.rows.last(),
        Some(FeedViewRow::Footer(row)) if row.state == FeedFooterState::TerminalWithRows
    ));
    Ok(())
}

#[test]
fn custom_request_invalid_view_has_no_demand_or_fake_rows() {
    let model = build_custom_request_feed_view(input(Some(invalid_plan()), empty_window()));

    assert_eq!(model.status, CustomRequestFeedStatus::Invalid);
    assert!(model.demand.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item)
            if item.reason == "custom-request-invalid"
                && item.detail.contains("InvalidJson"))
    }));
}

#[test]
fn custom_request_canceled_view_is_explicit_and_queryless() {
    let model = canceled_custom_request_feed_view("custom-tab");

    assert_eq!(model.status, CustomRequestFeedStatus::Canceled);
    assert!(model.demand.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item)
            if item.reason == "custom-request-canceled"
                && item.retry_available)
    }));
}

#[test]
fn custom_request_unavailable_view_is_explicit_and_queryless() {
    let model =
        unavailable_custom_request_feed_view("custom-tab", "Relay output unavailable.", false);

    assert_eq!(model.status, CustomRequestFeedStatus::Unavailable);
    assert!(model.demand.is_none());
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item)
            if item.reason == "custom-request-unavailable"
                && item.detail == "Relay output unavailable.")
    }));
}

#[test]
fn custom_request_partial_keeps_real_rows_and_unavailable_state() {
    let mut request = input(Some(ready_plan()), window_with_event());
    request.source_state = CustomRequestFeedSourceState::Partial {
        reason: "Relay read timed out.".to_owned(),
        retry_available: true,
    };
    let model = build_custom_request_feed_view(request);

    assert_eq!(model.status, CustomRequestFeedStatus::Partial);
    assert!(matches!(
        model.view_model.rows.first(),
        Some(FeedViewRow::Event(_))
    ));
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Unavailable(item)
            if item.reason == "custom-request-partial"
                && item.detail == "Relay read timed out.")
    }));
}

fn input(
    run_plan: Option<CustomRequestRunPlan>,
    window: lkjstr_app::FeedWindowState,
) -> CustomRequestFeedViewInput {
    CustomRequestFeedViewInput {
        owner: "custom-tab".to_owned(),
        run_plan,
        source_state: CustomRequestFeedSourceState::Complete,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
    }
}

fn ready_plan() -> CustomRequestRunPlan {
    plan_custom_request_run(CustomRequestRunInput {
        owner: "custom-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: relays(),
        disabled_relays: Vec::new(),
        raw_json: r#"{"kinds":[1],"limit":30}"#.to_owned(),
        now_sec: 1_700_000_030,
        page_size: 30,
    })
}

fn invalid_plan() -> CustomRequestRunPlan {
    CustomRequestRunPlan {
        status: CustomRequestRunStatus::Invalid,
        request: None,
        mode: None,
        demand: None,
        error: Some(CustomRequestError::new(CustomRequestErrorKind::InvalidJson)),
        relays: Vec::new(),
    }
}

fn window_with_event() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_window(),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive()],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn empty_window() -> lkjstr_app::FeedWindowState {
    empty_feed_window(1, 180)
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: relays(),
        sub_id: "custom-request".to_owned(),
        event: NostrEvent {
            id: id(1),
            pubkey: "a".repeat(64),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real custom request event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn relays() -> Vec<String> {
    vec!["wss://selected.example".to_owned()]
}

fn planned_relays() -> Vec<String> {
    vec!["wss://selected.example/".to_owned()]
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}
