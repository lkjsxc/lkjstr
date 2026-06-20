use lkjstr_app::{
    CustomRequestQueryInput, QuerySurface, SearchQueryInput, custom_request_query_input,
    parse_custom_request, plan_query_demand, search_query_input,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::{DemandPhase, DemandPurpose, DemandVisibility, RoutePlanGroupSource};

#[test]
fn search_query_input_uses_nip50_search_on_selected_relays() -> Result<(), String> {
    let query = search_query_input(search_input(" nostr wasm "))
        .ok_or_else(|| "wanted search demand".to_owned())?;
    let plan = plan_query_demand(query.clone());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };
    let [group] = plan.route_plan.groups.as_slice() else {
        return Err("wanted selected group".to_owned());
    };

    assert_eq!(query.phase, DemandPhase::Page);
    assert_eq!(query.purpose, DemandPurpose::Search);
    assert_eq!(filter.search.as_deref(), Some("nostr wasm"));
    assert_eq!(filter.authors, None);
    assert_eq!(
        filter.kinds,
        Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST])
    );
    assert_eq!(group.source, RoutePlanGroupSource::SelectedFallback);
    Ok(())
}

#[test]
fn search_query_input_rejects_empty_query() {
    assert!(search_query_input(search_input("  ")).is_none());
}

#[test]
fn custom_request_query_uses_explicit_relays_over_selected() -> Result<(), String> {
    let request =
        parse_custom_request(r#"{"filter":{"kinds":[1]},"relays":["https://explicit.example"]}"#)
            .map_err(|error| format!("{error:?}"))?;
    let query = custom_request_query_input(CustomRequestQueryInput {
        owner: "custom-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        request,
        now_sec: now_sec(),
        page_size: 30,
    });
    let plan = plan_query_demand(query);

    assert_eq!(
        plan.demand.relays,
        vec!["wss://explicit.example/".to_owned()]
    );
    assert_eq!(plan.demand.purpose, DemandPurpose::Feed);
    Ok(())
}

#[test]
fn custom_request_query_preserves_user_filter_bounds() -> Result<(), String> {
    let request = parse_custom_request(
        r#"{"filter":{"kinds":[1],"since":10,"until":20,"search":"nostr","limit":25}}"#,
    )
    .map_err(|error| format!("{error:?}"))?;
    let query = custom_request_query_input(CustomRequestQueryInput {
        owner: "custom-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        request,
        now_sec: now_sec(),
        page_size: 30,
    });
    let plan = plan_query_demand(query.clone());
    let [filter] = plan.wire_request.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(query.surface, QuerySurface::CustomRequest);
    assert_eq!(query.phase, DemandPhase::Page);
    assert_eq!(query.purpose, DemandPurpose::Feed);
    assert_eq!(query.channel.as_deref(), Some("custom-request"));
    assert_eq!(query.since, None);
    assert_eq!(query.until, None);
    assert_eq!(query.limit, Some(30));
    assert_eq!(filter.search.as_deref(), Some("nostr"));
    assert_eq!(filter.kinds, Some(vec![KIND_TEXT_NOTE]));
    assert_eq!(filter.since, Some(10));
    assert_eq!(filter.until, Some(20));
    assert_eq!(filter.limit, Some(25));
    assert_eq!(
        plan.wire_request.relays,
        vec!["wss://selected.example/".to_owned()]
    );
    assert_eq!(plan.wire_request.purpose, DemandPurpose::Feed);
    Ok(())
}

fn search_input(query: &str) -> SearchQueryInput {
    SearchQueryInput {
        owner: "search-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        query: query.to_owned(),
        since: Some(10),
        until: Some(20),
        now_sec: now_sec(),
        page_size: 30,
    }
}

const fn now_sec() -> u64 {
    1_700_000_030
}
