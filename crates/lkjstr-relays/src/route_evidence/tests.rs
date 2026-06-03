use crate::{
    AuthorRelayRoute, RouteEvidenceSource, RouteEvidenceTrustInput, RoutePlanGroupSource,
    RoutePlanInput, RoutePlanSurface, base_trust_for_source, merge_route_evidence_scores,
    nip65_trust_for_age, plan_relay_routes, route_evidence_trust_score,
};

use super::source::{FRESH_NIP65_TRUST, RECEIPT_TRUST, STALE_NIP65_TRUST};

#[test]
fn route_plan_preserves_selected_fallback_when_nip65_exists() -> Result<(), String> {
    let plan = plan_relay_routes(input(vec![route(
        RouteEvidenceSource::Nip65,
        "wss://nip65.example",
        0,
    )]));
    let fallback = find_group(&plan, RoutePlanGroupSource::SelectedFallback)?;

    assert_eq!(fallback.relays, vec!["wss://selected.example/".to_owned()]);
    Ok(())
}

#[test]
fn route_plan_prefers_measured_receipt_over_nip65() -> Result<(), String> {
    let plan = plan_relay_routes(input(vec![
        route(RouteEvidenceSource::Nip65, "wss://nip65.example", 20),
        route(RouteEvidenceSource::Receipt, "wss://receipt.example", 0),
    ]));
    let author = find_group(&plan, RoutePlanGroupSource::AuthorRoute)?;

    assert_eq!(
        author.relays.first().map(String::as_str),
        Some("wss://receipt.example/")
    );
    Ok(())
}

#[test]
fn route_plan_nip65_only_adds_bounded_targeted_attempt() -> Result<(), String> {
    let mut route_input = input(vec![
        route(RouteEvidenceSource::Nip65, "wss://a.example", 0),
        route(RouteEvidenceSource::Nip65, "wss://b.example", 0),
    ]);
    route_input.max_route_relays_per_author = 1;
    let plan = plan_relay_routes(route_input);
    let author = find_group(&plan, RoutePlanGroupSource::AuthorRoute)?;

    assert_eq!(author.relays.len(), 1);
    Ok(())
}

#[test]
fn route_plan_stale_nip65_decays_below_recent_receipt() {
    assert_eq!(
        base_trust_for_source(RouteEvidenceSource::Receipt),
        RECEIPT_TRUST
    );
    assert_eq!(nip65_trust_for_age(0, 1), FRESH_NIP65_TRUST);
    assert_eq!(
        nip65_trust_for_age(0, super::decay::NIP65_STALE_AFTER_MS + 1),
        STALE_NIP65_TRUST
    );
}

#[test]
fn route_trust_penalizes_failures_without_becoming_absence_proof() {
    let score = route_evidence_trust_score(&RouteEvidenceTrustInput {
        source: RouteEvidenceSource::Nip65,
        measured_success: 0,
        measured_failure: 2,
        timeout: true,
        auth_or_closed_or_error: false,
        repeated_no_yield: true,
        stale_nip65: true,
    });

    assert!(score < STALE_NIP65_TRUST);
}

#[test]
fn route_evidence_merge_orders_by_trust() {
    let merged = merge_route_evidence_scores(&[
        evidence(RouteEvidenceSource::Nip65, "wss://nip65.example", 0, 0),
        evidence(RouteEvidenceSource::Receipt, "wss://receipt.example", 1, 0),
    ]);

    assert_eq!(
        merged.first().map(|row| row.relay_url.as_str()),
        Some("wss://receipt.example")
    );
}

fn input(author_routes: Vec<AuthorRelayRoute>) -> RoutePlanInput {
    RoutePlanInput {
        surface: RoutePlanSurface::Home,
        selected_relays: vec!["wss://selected.example".to_owned()],
        authors: vec![pubkey()],
        author_routes,
        disabled_relays: Vec::new(),
        max_route_relays_per_author: 4,
        max_targeted_groups: 12,
        max_authors_per_group: 50,
    }
}

fn route(source: RouteEvidenceSource, relay_url: &str, score: i64) -> AuthorRelayRoute {
    AuthorRelayRoute {
        author: pubkey(),
        relay_url: relay_url.to_owned(),
        source,
        score,
    }
}

fn evidence(
    source: RouteEvidenceSource,
    relay_url: &str,
    measured_success: u64,
    measured_failure: u64,
) -> crate::MeasuredRouteEvidence {
    crate::MeasuredRouteEvidence {
        author: pubkey(),
        relay_url: relay_url.to_owned(),
        source,
        measured_success,
        measured_failure,
        last_success_at_ms: None,
        last_failure_at_ms: None,
    }
}

fn find_group(
    plan: &crate::RelayRoutePlan,
    source: RoutePlanGroupSource,
) -> Result<&crate::RoutePlanGroup, String> {
    plan.groups
        .iter()
        .find(|group| group.source == source)
        .ok_or_else(|| "wanted route group".to_owned())
}

fn pubkey() -> String {
    "a".repeat(64)
}
