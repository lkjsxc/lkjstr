use lkjstr_app::{
    CustomRequestFeedSourceState, CustomRequestFeedStatus, CustomRequestFeedViewInput,
    CustomRequestRunInput, FeedFragmentConfig, FeedViewRow, RowGeometryModel,
    build_custom_request_feed_view, custom_request::CustomRequestRelayLimitInput,
    custom_request::plan_custom_request_run_with_relay_limits, empty_feed_window,
};
use lkjstr_relays::{DemandVisibility, RequestRelayLimits};

#[test]
fn custom_request_run_applies_nip11_limit_to_relay_filters() -> Result<(), String> {
    let plan = limited_plan();
    let request = plan.request.as_ref().ok_or("missing request")?;

    assert_eq!(request.filters[0].limit, Some(30));
    assert_eq!(request.relay_limit_clamps.len(), 1);
    assert_eq!(
        request.relay_limit_clamps[0].relay_url,
        "wss://selected.example/"
    );
    assert_eq!(request.relay_limit_clamps[0].original_limit, 30);
    assert_eq!(request.relay_limit_clamps[0].effective_limit, 20);
    assert_eq!(request.relay_filters[0].filters[0].limit, Some(20));
    Ok(())
}

#[test]
fn custom_request_view_names_nip11_effective_outbound_filter() {
    let model = build_custom_request_feed_view(CustomRequestFeedViewInput {
        owner: "custom-tab".to_owned(),
        run_plan: Some(limited_plan()),
        source_state: CustomRequestFeedSourceState::Complete,
        window: empty_feed_window(1, 180),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
    });

    assert_eq!(model.status, CustomRequestFeedStatus::Ready);
    assert!(model.view_model.rows.iter().any(|row| {
        matches!(row, FeedViewRow::Diagnostic(item)
            if item.scope == "custom-request"
                && item.diagnostic_id == "effective-filters"
                && item.message.contains("wss://selected.example/")
                && item.message.contains("NIP-11 max_limit")
                && item.message.contains("limit 20"))
    }));
}

fn limited_plan() -> lkjstr_app::CustomRequestRunPlan {
    plan_custom_request_run_with_relay_limits(
        CustomRequestRunInput {
            owner: "custom-tab".to_owned(),
            visibility: DemandVisibility::Visible,
            selected_relays: vec!["wss://selected.example".to_owned()],
            disabled_relays: Vec::new(),
            raw_json: r#"{"filter":{"kinds":[1],"limit":30}}"#.to_owned(),
            now_sec: 1_700_000_030,
            page_size: 30,
        },
        vec![CustomRequestRelayLimitInput {
            relay_url: "wss://selected.example/".to_owned(),
            limits: RequestRelayLimits {
                max_limit: Some(20),
                ..RequestRelayLimits::default()
            },
        }],
    )
}
