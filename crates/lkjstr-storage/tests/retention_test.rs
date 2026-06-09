use lkjstr_storage::{
    CacheResourceKind, RetentionByteTarget, RetentionCandidate, RetentionDynamicProtection,
    RetentionPlanInput, RetentionStopReason, candidate_is_dynamically_protected,
    candidate_is_prunable, plan_retention,
};

#[test]
fn retention_stop_reason_labels_are_exact() {
    assert_eq!(
        [
            RetentionStopReason::NoPrunableCandidates.as_str(),
            RetentionStopReason::ProtectedOnly.as_str(),
            RetentionStopReason::UnknownUnownedUsage.as_str(),
            RetentionStopReason::InventoryIncomplete.as_str(),
            RetentionStopReason::QuotaPressure.as_str(),
            RetentionStopReason::StorageApiUnavailable.as_str(),
            RetentionStopReason::CompactionError.as_str(),
        ],
        [
            "no-prunable-candidates",
            "protected-only",
            "unknown-unowned-usage",
            "inventory-incomplete",
            "quota-pressure",
            "storage-api-unavailable",
            "compaction-error",
        ]
    );
}

#[test]
fn retention_empty_ledger_reports_no_prunable_candidates() {
    let plan = plan_retention(input(vec![], vec![], 200, 100));
    assert_eq!(
        plan.stop_reason,
        Some(RetentionStopReason::NoPrunableCandidates)
    );
    assert!(plan.intents.is_empty());
}

#[test]
fn retention_skips_protected_resource_kinds() {
    let candidate = candidate("event-1", 40, 1, true);
    assert!(!candidate_is_prunable(&candidate));
    let plan = plan_retention(input(vec![candidate], vec![], 200, 100));
    assert_eq!(plan.stop_reason, Some(RetentionStopReason::ProtectedOnly));
    assert_eq!(plan.summary.skipped_protected_count, 1);
}

#[test]
fn retention_skips_dynamic_protection() {
    let candidate = candidate("event-1", 40, 1, false);
    let protection = RetentionDynamicProtection {
        resource_kind: CacheResourceKind::NostrEvent,
        resource_id: "event-1".to_owned(),
        reason: "visible-row".to_owned(),
    };
    assert!(candidate_is_dynamically_protected(
        &candidate,
        &[protection.clone()]
    ));
    let plan = plan_retention(input(vec![candidate], vec![protection], 200, 100));
    assert!(plan.intents.is_empty());
    assert_eq!(plan.summary.skipped_dynamic_protected_count, 1);
}

#[test]
fn retention_reports_protected_only_when_only_protected_rows_exist() {
    let plan = plan_retention(input(
        vec![candidate("event-1", 40, 1, true)],
        vec![],
        200,
        100,
    ));
    assert_eq!(plan.stop_reason, Some(RetentionStopReason::ProtectedOnly));
}

#[test]
fn retention_reports_inventory_incomplete_when_required_inventory_missing() {
    let mut request = input(vec![candidate("event-1", 40, 1, false)], vec![], 200, 100);
    request.inventory_complete = false;
    let plan = plan_retention(request);
    assert_eq!(
        plan.stop_reason,
        Some(RetentionStopReason::InventoryIncomplete)
    );
    assert!(plan.intents.is_empty());
}

#[test]
fn retention_reports_unknown_usage_when_browser_usage_cannot_be_owned() {
    let mut request = input(vec![candidate("event-1", 20, 1, false)], vec![], 200, 100);
    request.unknown_unowned_usage_bytes = 100;
    let plan = plan_retention(request);
    assert_eq!(
        plan.stop_reason,
        Some(RetentionStopReason::UnknownUnownedUsage)
    );
    assert_eq!(plan.summary.selected_bytes, 20);
}

#[test]
fn retention_orders_candidates_deterministically() {
    let rows = vec![
        candidate("event-c", 40, 3, false),
        candidate("event-b", 40, 1, false),
        candidate("event-a", 40, 1, false),
    ];
    let plan = plan_retention(input(rows, vec![], 220, 100));
    let ids: Vec<_> = plan
        .intents
        .iter()
        .map(|intent| intent.resource_id.as_str())
        .collect();
    assert_eq!(ids, vec!["event-a", "event-b", "event-c"]);
}

#[test]
fn retention_selects_until_target_or_stop_reason() {
    let rows = vec![
        candidate("event-a", 70, 1, false),
        candidate("event-b", 50, 2, false),
        candidate("event-c", 50, 3, false),
    ];
    let plan = plan_retention(input(rows, vec![], 200, 100));
    assert_eq!(plan.stop_reason, None);
    assert_eq!(plan.summary.selected_count, 2);
    assert!(plan.summary.target_met);
}

fn input(
    candidates: Vec<RetentionCandidate>,
    dynamic_protections: Vec<RetentionDynamicProtection>,
    usage_bytes: u64,
    target_bytes: u64,
) -> RetentionPlanInput {
    RetentionPlanInput {
        byte_target: RetentionByteTarget {
            target_bytes,
            usage_bytes: Some(usage_bytes),
        },
        candidates,
        dynamic_protections,
        inventory_complete: true,
        storage_api_available: true,
        quota_pressure: false,
        compaction_error: false,
        unknown_unowned_usage_bytes: 0,
    }
}

fn candidate(id: &str, byte_count: u64, updated_at_ms: u64, protected: bool) -> RetentionCandidate {
    RetentionCandidate {
        resource_id: id.to_owned(),
        resource_kind: CacheResourceKind::NostrEvent,
        table_name: "events".to_owned(),
        byte_count,
        score: 10,
        updated_at_ms,
        protected,
        ledger_backed: true,
        recoverable: true,
    }
}
