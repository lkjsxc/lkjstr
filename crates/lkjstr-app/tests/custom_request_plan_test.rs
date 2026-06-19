use lkjstr_app::{
    CustomRequestErrorKind, CustomRequestMode, CustomRequestRunInput, CustomRequestRunStatus,
    plan_custom_request_run, plan_query_demand,
};
use lkjstr_relays::{DemandPurpose, DemandVisibility};
use serde_json::json;

#[test]
fn custom_request_run_plans_exact_demand_with_explicit_relays() -> Result<(), String> {
    let plan = plan_custom_request_run(input(
        json!({"filter":{"ids":[hex("a")]},"relays":["https://explicit.example"]}).to_string(),
        vec!["https://selected.example".to_owned()],
    ));
    let demand = plan.demand.clone().ok_or("missing demand")?;
    let relay_plan = plan_query_demand(demand.clone());

    assert_eq!(plan.status, CustomRequestRunStatus::Ready);
    assert_eq!(plan.mode, Some(CustomRequestMode::Exact));
    assert_eq!(plan.relays, vec!["wss://explicit.example/".to_owned()]);
    assert_eq!(
        relay_plan.demand.relays,
        vec!["wss://explicit.example/".to_owned()]
    );
    assert_eq!(demand.purpose, DemandPurpose::Feed);
    Ok(())
}

#[test]
fn custom_request_run_uses_selected_relays_when_request_has_none() -> Result<(), String> {
    let plan = plan_custom_request_run(input(
        r#"{"filter":{"kinds":[1],"since":10,"until":20}}"#.to_owned(),
        vec!["https://selected.example".to_owned()],
    ));
    let relay_plan = plan_query_demand(plan.demand.clone().ok_or("missing demand")?);

    assert_eq!(plan.status, CustomRequestRunStatus::Ready);
    assert_eq!(plan.mode, Some(CustomRequestMode::AdaptiveFeed));
    assert_eq!(plan.relays, vec!["wss://selected.example/".to_owned()]);
    assert_eq!(
        relay_plan.demand.relays,
        vec!["wss://selected.example/".to_owned()]
    );
    Ok(())
}

#[test]
fn custom_request_run_preserves_effective_clamped_filter() -> Result<(), String> {
    let plan = plan_custom_request_run(input(
        r#"{"filter":{"kinds":[1],"limit":999}}"#.to_owned(),
        vec!["https://selected.example".to_owned()],
    ));
    let demand = plan.demand.clone().ok_or("missing demand")?;

    assert_eq!(plan.status, CustomRequestRunStatus::Ready);
    assert_eq!(demand.filters[0].limit, Some(500));
    assert_eq!(
        plan.request.as_ref().ok_or("missing request")?.limit_clamps[0].original_limit,
        999
    );
    Ok(())
}

#[test]
fn custom_request_run_rejects_invalid_input_without_demand() {
    let plan = plan_custom_request_run(input(
        "{".to_owned(),
        vec!["wss://selected.example/".into()],
    ));

    assert_eq!(plan.status, CustomRequestRunStatus::Invalid);
    assert_eq!(
        plan.error.map(|error| error.kind),
        Some(CustomRequestErrorKind::InvalidJson)
    );
    assert!(plan.demand.is_none());
}

#[test]
fn custom_request_run_requires_a_relay_before_demand() {
    let plan = plan_custom_request_run(input(r#"{"filter":{"kinds":[1]}}"#.to_owned(), Vec::new()));

    assert_eq!(plan.status, CustomRequestRunStatus::NoRelay);
    assert_eq!(plan.mode, Some(CustomRequestMode::AdaptiveFeed));
    assert!(plan.request.is_some());
    assert!(plan.demand.is_none());
    assert!(plan.error.is_none());
}

#[test]
fn custom_request_run_excludes_disabled_relays_before_demand() {
    let mut request = input(
        r#"{"filter":{"kinds":[1]}}"#.to_owned(),
        vec!["https://selected.example".to_owned()],
    );
    request.disabled_relays = vec!["wss://selected.example/".to_owned()];

    let plan = plan_custom_request_run(request);

    assert_eq!(plan.status, CustomRequestRunStatus::NoRelay);
    assert_eq!(plan.mode, Some(CustomRequestMode::AdaptiveFeed));
    assert!(plan.demand.is_none());
    assert!(plan.relays.is_empty());
}

fn input(raw_json: String, selected_relays: Vec<String>) -> CustomRequestRunInput {
    CustomRequestRunInput {
        owner: "custom-request-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays,
        disabled_relays: Vec::new(),
        raw_json,
        now_sec: 1_700_000_030,
        page_size: 30,
    }
}

fn hex(value: &str) -> String {
    value.repeat(64)
}
