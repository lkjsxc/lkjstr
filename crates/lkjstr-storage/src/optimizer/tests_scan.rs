use crate::CacheResourceKind;

use super::*;

fn context() -> ScanModelContextRecord {
    ScanModelContextRecord {
        semantic_feed_key: "home:account:selected".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: "older".to_owned(),
        route_fingerprint: "route-a".to_owned(),
    }
}

fn model(scope: StoredScanModelScope, updated_at_ms: u64) -> ScanDensityModelRecord {
    let key = scan_model_key_for_scope(&context(), scope.clone());
    let model_key = scan_model_storage_key(&key).unwrap_or_else(|_| "bad-key".to_owned());
    ScanDensityModelRecord {
        model_key,
        scope,
        semantic_feed_key: key.semantic_feed_key,
        route_group_key: key.route_group_key,
        relay_url: key.relay_url,
        semantic_filter_key: key.semantic_filter_key,
        direction: key.direction,
        route_fingerprint: key.route_fingerprint,
        target_limit_fraction: "2/3".to_owned(),
        density_events_per_second: 0.1,
        log_density_mean: 0.1_f64.ln(),
        log_density_variance: 0.01,
        sample_weight: 2.0,
        complete_window_count: 2,
        dense_window_count: 0,
        sparse_window_count: 1,
        incomplete_window_count: 0,
        failure_window_count: 0,
        limit_hit_rate: 0.0,
        incomplete_rate: 0.0,
        last_good_span_seconds: 600,
        last_proposed_span_seconds: 660,
        last_observed_since_seconds: 1,
        last_observed_until_seconds: 601,
        updated_at_ms,
        decays_after_ms: updated_at_ms + 100,
    }
}

#[test]
fn scan_density_exact_model_round_trips() {
    let record = model(StoredScanModelScope::Exact, 1_000);
    let row = sqlite_scan_density_model_row(&record);

    assert_eq!(scan_density_model_from_sqlite_row(&row), record);
    assert!(scan_density_model_storage_key(&row).is_ok());
}

#[test]
fn scan_density_parent_model_round_trips() {
    let record = model(StoredScanModelScope::RelayFilter, 1_000);
    let row = sqlite_scan_density_model_row(&record);

    assert_eq!(scan_density_model_from_sqlite_row(&row), record);
    assert_eq!(row.route_group_key, "");
}

#[test]
fn scan_model_key_rejects_transient_owner_fields() {
    let mut ctx = context();
    ctx.semantic_feed_key = "home:tab_id=abc".to_owned();
    let key = scan_model_key_for_scope(&ctx, StoredScanModelScope::Exact);

    assert_eq!(
        scan_model_storage_key(&key),
        Err(OptimizerKeyProblem::TransientOwnerKey)
    );
}

#[test]
fn select_scan_models_returns_exact_and_parents_in_order() {
    let rows = vec![
        model(StoredScanModelScope::RelayFilter, 2_000),
        model(StoredScanModelScope::Exact, 1_000),
        model(StoredScanModelScope::Surface, 3_000),
    ];
    let selected = select_scan_models_for_context(&rows, &context());

    assert_eq!(selected[0].scope, StoredScanModelScope::Exact);
    assert_eq!(selected[1].scope, StoredScanModelScope::RelayFilter);
    assert_eq!(selected[2].scope, StoredScanModelScope::Surface);
}

#[test]
fn stale_model_returns_decayed_confidence_instead_of_omission() {
    let rows = vec![model(StoredScanModelScope::Exact, 1_000)];
    let selected = select_scan_models_for_context(&rows, &context());
    let confidence = decayed_scan_model_confidence(&selected[0], 61_000, 60_000);

    assert!(!selected.is_empty());
    assert!(confidence > 0.0);
    assert!(confidence < selected[0].sample_weight);
}

#[test]
fn scan_observation_and_trace_rows_round_trip() {
    let observation = ScanObservationRecord {
        id: "obs".to_owned(),
        semantic_feed_key: "feed".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: "older".to_owned(),
        route_fingerprint: "route".to_owned(),
        since_seconds: 1,
        until_seconds: 601,
        requested_limit: 100,
        effective_limit: 100,
        event_count: 20,
        unique_event_count: 20,
        final_visible_count: 20,
        event_limit_reached: false,
        eose: true,
        timeout: false,
        closed: false,
        auth: false,
        socket_error: false,
        bytes_sent: 10,
        bytes_received: 20,
        started_at_ms: 1,
        completed_at_ms: 2,
        created_at_ms: 2,
    };
    let trace = ScanDecisionTraceRecord {
        trace_id: "trace".to_owned(),
        model_key: "model".to_owned(),
        semantic_feed_key: "feed".to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "kinds:1".to_owned(),
        direction: "older".to_owned(),
        route_fingerprint: "route".to_owned(),
        source_scope: StoredScanModelScope::Exact,
        confidence: 0.5,
        target_count: 66,
        effective_limit: 100,
        density_events_per_second: 0.1,
        previous_span_seconds: 600,
        proposed_span_seconds: 660,
        cap_reason: None,
        diagnostics_json: "[]".to_owned(),
        created_at_ms: 2,
    };

    assert_eq!(scan_observation_from_sqlite_row(&observation), observation);
    assert_eq!(scan_decision_trace_from_sqlite_row(&trace), trace);
}

#[test]
fn optimizer_inventory_includes_scan_model_tables() {
    let tables = optimizer_inventory_tables();

    assert!(tables.contains(&"feed_scan_observations"));
    assert!(tables.contains(&"feed_scan_density_models"));
    assert!(optimizer_resource_kind(CacheResourceKind::ScanDensityModel));
}
