use lkjstr_app::{
    ThreadRepliesQueryInput, ThreadRootLookupInput, plan_query_demand, thread_replies_query_input,
    thread_root_lookup_input,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::{
    AuthorRelayRoute, DemandPhase, DemandPurpose, DemandVisibility, RouteEvidenceSource,
    RoutePlanGroupSource,
};

#[test]
fn thread_root_lookup_uses_exact_id_and_event_lookup_purpose() -> Result<(), String> {
    let query = thread_root_lookup_input(root_input(Some(pubkey("a"))));
    let plan = plan_query_demand(query.clone());
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };
    let author = plan
        .route_plan
        .groups
        .iter()
        .find(|group| group.source == RoutePlanGroupSource::AuthorRoute)
        .ok_or_else(|| "wanted author route".to_owned())?;

    assert_eq!(query.channel.as_deref(), Some("thread-root"));
    assert_eq!(query.phase, DemandPhase::Bootstrap);
    assert_eq!(query.purpose, DemandPurpose::EventLookup);
    assert_eq!(filter.ids, Some(vec![event_id()]));
    assert_eq!(filter.limit, Some(1));
    assert_eq!(author.relays, vec!["wss://route.example/".to_owned()]);
    Ok(())
}

#[test]
fn thread_replies_query_targets_e_tag_without_author_filter() -> Result<(), String> {
    let query = thread_replies_query_input(replies_input(Some(pubkey("a"))));
    let [filter] = query.filters.as_slice() else {
        return Err("wanted one filter".to_owned());
    };

    assert_eq!(query.channel.as_deref(), Some("thread-replies"));
    assert_eq!(query.phase, DemandPhase::Page);
    assert_eq!(filter.authors, None);
    assert_eq!(filter.tags.get("e"), Some(&vec![event_id()]));
    assert_eq!(
        filter.kinds,
        Some(vec![KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST])
    );
    Ok(())
}

#[test]
fn thread_without_root_author_uses_selected_fallback_only() -> Result<(), String> {
    let plan = plan_query_demand(thread_replies_query_input(replies_input(None)));
    let [group] = plan.route_plan.groups.as_slice() else {
        return Err("wanted selected group".to_owned());
    };

    assert_eq!(group.source, RoutePlanGroupSource::SelectedFallback);
    assert_eq!(group.relays, vec!["wss://selected.example/".to_owned()]);
    Ok(())
}

fn root_input(root_author: Option<String>) -> ThreadRootLookupInput {
    ThreadRootLookupInput {
        owner: "thread-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        event_id: event_id(),
        root_author,
        author_routes: vec![route(pubkey("a"), "https://route.example")],
        now_sec: now_sec(),
    }
}

fn replies_input(root_author: Option<String>) -> ThreadRepliesQueryInput {
    ThreadRepliesQueryInput {
        owner: "thread-tab".to_owned(),
        visibility: DemandVisibility::Visible,
        selected_relays: vec!["https://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        root_event_id: event_id(),
        root_author,
        author_routes: vec![route(pubkey("a"), "https://route.example")],
        phase: DemandPhase::Page,
        since: Some(10),
        until: Some(20),
        now_sec: now_sec(),
        page_size: 30,
    }
}

fn route(author: String, relay_url: &str) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author,
        relay_url: relay_url.to_owned(),
        source: RouteEvidenceSource::Nip65,
        score: 10,
    }
}

fn event_id() -> String {
    "f".repeat(64)
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}
