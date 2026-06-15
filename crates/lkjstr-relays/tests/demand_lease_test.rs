use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    Demand, DemandAttachAction, DemandDetachAction, DemandLeaseRegistry, DemandPhase,
    DemandPurpose, DemandSurface, DemandVisibility, DemandVisibilityAction, demand_to_wire_request,
    normalized_demand_filters, wire_equivalent_fingerprint,
};

#[test]
fn fingerprint_is_stable_for_equivalent_wire_demands() {
    let mut left = live_demand("tab-a", vec!["wss://b", "wss://a/"]);
    left.filters = vec![filter(vec![1, 1], vec![pubkey("b"), pubkey("a")])];
    let mut right = live_demand("tab-b", vec!["wss://a/", "https://b"]);
    right.filters = vec![filter(vec![1], vec![pubkey("a"), pubkey("b")])];

    assert_eq!(
        wire_equivalent_fingerprint(&left, now_sec()),
        wire_equivalent_fingerprint(&right, now_sec())
    );
}

#[test]
fn surface_identity_does_not_split_wire_equivalent_leases() {
    let home = live_demand("tab-a", vec!["wss://relay"]);
    let mut search = home.clone();
    search.owner = "tab-b".to_owned();
    search.surface = DemandSurface::Search;
    let mut registry = DemandLeaseRegistry::new();
    let first = registry.attach(home.clone(), now_sec());
    let second = registry.attach(search.clone(), now_sec());

    assert_eq!(
        wire_equivalent_fingerprint(&home, now_sec()),
        wire_equivalent_fingerprint(&search, now_sec())
    );
    assert_eq!(first.action, DemandAttachAction::Start);
    assert_eq!(second.action, DemandAttachAction::Share);
    assert_eq!(second.snapshot.owner_count, 2);
    assert_eq!(registry.counts().active_leases, 1);
}

#[test]
fn live_filter_normalization_removes_limits_and_uses_demand_since() -> Result<(), String> {
    let since = 1_700_000_000;
    let mut left = live_demand("tab-a", vec!["wss://relay"]);
    left.since = Some(since);
    left.filters = vec![NostrFilter {
        kinds: Some(vec![1]),
        since: Some(since - 5),
        limit: Some(30),
        ..NostrFilter::default()
    }];
    let mut right = left.clone();
    right.owner = "tab-b".to_owned();
    let Some(filter) = right.filters.get_mut(0) else {
        return Err("wanted right filter".to_owned());
    };
    filter.since = Some(since);

    let filters = normalized_demand_filters(&left, now_sec());
    let [filter] = filters.as_slice() else {
        return Err("wanted one normalized filter".to_owned());
    };

    assert_eq!(filter.since, Some(since));
    assert_eq!(filter.limit, None);
    assert_eq!(
        wire_equivalent_fingerprint(&left, now_sec()),
        wire_equivalent_fingerprint(&right, now_sec())
    );
    Ok(())
}

#[test]
fn channel_disambiguates_live_leases() {
    let mut notes = live_demand("tab-a", vec!["wss://relay"]);
    notes.channel = Some("notes".to_owned());
    let mut metadata = notes.clone();
    metadata.channel = Some("metadata".to_owned());

    assert_ne!(
        wire_equivalent_fingerprint(&notes, now_sec()),
        wire_equivalent_fingerprint(&metadata, now_sec())
    );
}

#[test]
fn registry_refcounts_compatible_visible_owners() {
    let mut registry = DemandLeaseRegistry::new();
    let first = registry.attach(live_demand("tab-a", vec!["wss://relay"]), now_sec());
    let second = registry.attach(live_demand("tab-b", vec!["wss://relay/"]), now_sec());
    let fingerprint = first.snapshot.fingerprint.clone();
    let release_a = registry.release("tab-a", &fingerprint);
    let release_b = registry.release("tab-b", &fingerprint);

    assert_eq!(first.action, DemandAttachAction::Start);
    assert_eq!(second.action, DemandAttachAction::Share);
    assert_eq!(second.snapshot.owner_count, 2);
    assert_eq!(release_a.action, DemandDetachAction::Keep);
    assert_eq!(release_b.action, DemandDetachAction::Close);
    assert_eq!(registry.counts().active_leases, 0);
}

#[test]
fn registry_visibility_reports_suspend_and_resume() -> Result<(), String> {
    let mut registry = DemandLeaseRegistry::new();
    let mut hidden = live_demand("tab-a", vec!["wss://relay"]);
    hidden.visibility = DemandVisibility::Hidden;
    let attached = registry.attach(hidden, now_sec());
    let resume_outcomes = registry.set_owner_visibility("tab-a", DemandVisibility::Visible);
    let [resumed] = resume_outcomes.as_slice() else {
        return Err("wanted resume visibility outcome".to_owned());
    };
    let suspend_outcomes = registry.set_owner_visibility("tab-a", DemandVisibility::Hidden);
    let [suspended] = suspend_outcomes.as_slice() else {
        return Err("wanted suspend visibility outcome".to_owned());
    };

    assert_eq!(attached.action, DemandAttachAction::RegisterHidden);
    assert_eq!(resumed.action, DemandVisibilityAction::Resume);
    assert_eq!(suspended.action, DemandVisibilityAction::Suspend);
    Ok(())
}

#[test]
fn demand_wire_request_uses_normalized_relays() {
    let request = demand_to_wire_request(
        &live_demand("tab-a", vec!["https://b", "wss://a/"]),
        now_sec(),
    );

    assert_eq!(request.key.len(), "lease:".len() + 12);
    assert_eq!(
        request.relays,
        vec!["wss://a/".to_owned(), "wss://b/".to_owned()]
    );
}

fn live_demand(owner: &str, relays: Vec<&str>) -> Demand {
    Demand {
        surface: DemandSurface::Home,
        phase: DemandPhase::Live,
        relays: relays.into_iter().map(str::to_owned).collect(),
        filters: vec![filter(vec![1], vec![pubkey("a")])],
        purpose: DemandPurpose::Feed,
        owner: owner.to_owned(),
        visibility: DemandVisibility::Visible,
        priority: None,
        since: Some(now_sec()),
        until: None,
        limit: None,
        staleness_ms: None,
        channel: Some("notes".to_owned()),
    }
}

fn filter(kinds: Vec<u64>, authors: Vec<String>) -> NostrFilter {
    NostrFilter {
        authors: Some(authors),
        kinds: Some(kinds),
        limit: Some(30),
        ..NostrFilter::default()
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

const fn now_sec() -> u64 {
    1_700_000_030
}
