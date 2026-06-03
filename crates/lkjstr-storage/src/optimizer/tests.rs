use std::collections::BTreeSet;

use crate::{
    CacheResourceKind, StorageStatsSnapshot, StorageTableCount, sqlite_schema_table_names,
};

use super::*;

#[test]
fn storage_optimizer_score_round_trip() {
    let score = RelayReadScoreRecord {
        relay_url: "wss://relay.example/".to_owned(),
        surface: "home".to_owned(),
        phase: "page".to_owned(),
        direction: "older".to_owned(),
        route_group_key: "selected".to_owned(),
        filter_shape: "kinds:1".to_owned(),
        purpose: "feed".to_owned(),
        reliability: 0.8,
        first_event_speed: 0.7,
        eose_speed: 0.6,
        useful_yield: 0.5,
        unique_yield: 0.4,
        penalty: 0.1,
        fairness_credit: 0.2,
        sample_count: 3,
        updated_at_ms: 10,
    };

    let row = sqlite_relay_read_score_row(&score);

    assert_eq!(relay_read_score_from_sqlite_row(&row), score);
    assert!(relay_read_score_key(&score).contains("selected"));
}

#[test]
fn storage_optimizer_observation_retention_deletes_old_rows() {
    let old = observation("old", 1);
    let kept = observation("kept", 10_000);
    let policy = OptimizerRetentionPolicy {
        observation_max_age_ms: 100,
        observation_max_rows: 10,
    };
    let plan = plan_optimizer_observation_retention(&[old, kept], 10_001, &policy);

    assert_eq!(plan.delete_observation_ids, vec!["old".to_owned()]);
}

#[test]
fn storage_optimizer_scan_hint_round_trip() {
    let hint = scan_hint("feed");
    let row = sqlite_optimizer_scan_hint_row(&hint);

    assert_eq!(optimizer_scan_hint_from_sqlite_row(&row), hint);
}

#[test]
fn storage_optimizer_scan_hint_key_rejects_tab_id() {
    let mut hint = scan_hint("feed:tab_id=abc");

    assert_eq!(
        optimizer_scan_hint_key(&hint),
        Err(OptimizerKeyProblem::TransientOwnerKey)
    );
    hint.semantic_feed_key = "feed".to_owned();
    assert!(optimizer_scan_hint_key(&hint).is_ok());
}

#[test]
fn storage_optimizer_repair_deletes_orphan_optimizer_ledger_rows() {
    let probes = vec![
        OptimizerLedgerProbe {
            ledger_id: "missing".to_owned(),
            resource_kind: CacheResourceKind::RelayReadScore,
            resource_id: "score-a".to_owned(),
        },
        OptimizerLedgerProbe {
            ledger_id: "kept".to_owned(),
            resource_kind: CacheResourceKind::RelayReadScore,
            resource_id: "score-b".to_owned(),
        },
    ];
    let existing = BTreeSet::from(["score-b".to_owned()]);

    assert_eq!(
        orphan_optimizer_ledger_ids(&probes, &existing),
        vec!["missing"]
    );
}

#[test]
fn storage_optimizer_inventory_counts_optimizer_rows() {
    let names = sqlite_schema_table_names();
    let counts = optimizer_tables()
        .iter()
        .map(|table| StorageTableCount::available(*table, 1))
        .collect();
    let snapshot = StorageStatsSnapshot::from_sqlite_counts(counts);

    assert!(names.contains(&"relay_read_scores"));
    assert!(
        snapshot
            .rows
            .iter()
            .any(|row| row.table == "feed_scan_hints")
    );
}

fn observation(id: &str, created_at_ms: u64) -> RelayReadObservationRecord {
    RelayReadObservationRecord {
        id: id.to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        surface: "home".to_owned(),
        phase: "page".to_owned(),
        direction: "older".to_owned(),
        route_group_key: "selected".to_owned(),
        semantic_feed_key: "feed".to_owned(),
        semantic_filter_key: "filter".to_owned(),
        purpose: "feed".to_owned(),
        started_at_ms: 1,
        first_event_ms: Some(2),
        eose_ms: Some(3),
        duration_ms: 3,
        event_count: 2,
        unique_event_count: 2,
        final_count: 2,
        timeout: false,
        closed: false,
        auth: false,
        socket_error: false,
        event_limit_reached: false,
        bytes_sent: 10,
        bytes_received: 20,
        route_evidence_sources: vec!["selected".to_owned()],
        created_at_ms,
    }
}

fn scan_hint(semantic_feed_key: &str) -> OptimizerScanHintRecord {
    OptimizerScanHintRecord {
        semantic_feed_key: semantic_feed_key.to_owned(),
        route_group_key: "selected".to_owned(),
        relay_url: "wss://relay.example/".to_owned(),
        semantic_filter_key: "filter".to_owned(),
        direction: "older".to_owned(),
        route_fingerprint: "route".to_owned(),
        current_span_seconds: 60,
        next_span_seconds: 120,
        min_span_seconds: 1,
        max_span_seconds: 3600,
        last_feedback: "under-half".to_owned(),
        density_ewma: 0.2,
        complete_window_count: 1,
        dense_window_count: 0,
        incomplete_window_count: 0,
        last_since: 1,
        last_until: 61,
        updated_at_ms: 1_000,
        expires_at_ms: 2_000,
    }
}
