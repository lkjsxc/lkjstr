use lkjstr_storage::{
    CacheResourceKind, RetentionDeleteDispatchInput, RetentionDeleteIntent,
    RetentionDynamicProtection, RetentionStopReason, StorageOutcome, StorageProblemKind,
};
use lkjstr_web::retention_dispatch::{
    RetentionDispatchBatch, RetentionDispatchStep, retention_delete_dispatch_steps,
};

#[test]
fn retention_event_deletion_batches_children_event_and_ledger() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "event-1",
        CacheResourceKind::NostrEvent,
        "events",
        50,
    )])?;
    assert_eq!(
        statement_ids(&batch.steps),
        vec![
            "event_tags.delete_by_event",
            "event_relays.delete_by_event",
            "events.delete",
            "cache_ledger.delete",
        ]
    );
    assert_eq!(batch.output.attempted_count, 1);
    assert_eq!(batch.output.deleted_count, 1);
    assert_eq!(batch.output.bytes_deleted_or_estimated, 50);
    Ok(())
}

#[test]
fn retention_feed_cursor_deletion_pairs_resource_and_ledger() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "cursor-1",
        CacheResourceKind::FeedCursor,
        "feed_cursors",
        10,
    )])?;
    assert_eq!(
        statement_ids(&batch.steps),
        vec!["feed_cursors.delete", "cache_ledger.delete"]
    );
    assert_eq!(first_param(&batch.steps[0]), Some("cursor-1"));
    assert_eq!(first_param(&batch.steps[1]), Some("cursor-1"));
    Ok(())
}

#[test]
fn retention_diagnostic_deletion_pairs_resource_and_ledger() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "wss://relay.example",
        CacheResourceKind::RelayInfo,
        "relay_information",
        12,
    )])?;
    assert_eq!(
        statement_ids(&batch.steps),
        vec!["relay_information.delete", "cache_ledger.delete"]
    );
    assert_eq!(batch.output.stop_reason, None);
    Ok(())
}

#[test]
fn retention_protected_table_input_is_skipped() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "settings-key",
        CacheResourceKind::FeedCursor,
        "settings",
        10,
    )])?;
    assert!(batch.steps.is_empty());
    assert_eq!(batch.output.skipped_protected_count, 1);
    assert_eq!(
        batch.output.stop_reason,
        Some(RetentionStopReason::ProtectedOnly)
    );
    assert!(
        batch
            .output
            .problems
            .contains(&StorageProblemKind::PressureProtectedOnly)
    );
    Ok(())
}

#[test]
fn retention_dynamic_protection_is_skipped() -> Result<(), String> {
    let dynamic = [RetentionDynamicProtection {
        resource_kind: CacheResourceKind::CoverageRow,
        resource_id: "coverage-1".to_owned(),
        reason: "visible-feed".to_owned(),
    }];
    let input = RetentionDeleteDispatchInput {
        intents: vec![intent(
            "coverage-1",
            CacheResourceKind::CoverageRow,
            "feed_coverage",
            20,
        )],
        bytes_targeted: 20,
    };
    let batch = match retention_delete_dispatch_steps(input, &dynamic) {
        StorageOutcome::Ok(batch) => batch,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    assert!(batch.steps.is_empty());
    assert_eq!(batch.output.skipped_dynamic_protected_count, 1);
    assert_eq!(batch.output.deleted_count, 0);
    Ok(())
}

#[test]
fn retention_unknown_table_returns_typed_problem() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "mystery",
        CacheResourceKind::FeedCursor,
        "mystery_table",
        10,
    )])?;
    assert!(batch.steps.is_empty());
    assert_eq!(
        batch.output.stop_reason,
        Some(RetentionStopReason::CompactionError)
    );
    assert!(
        batch
            .output
            .problems
            .contains(&StorageProblemKind::PressureCompactionError)
    );
    Ok(())
}

#[test]
fn retention_dispatch_steps_do_not_format_raw_sql() -> Result<(), String> {
    let batch = retention_batch(vec![intent(
        "score-key",
        CacheResourceKind::RelayReadScore,
        "relay_read_scores",
        8,
    )])?;
    for id in statement_ids(&batch.steps) {
        assert!(!id.contains(' '));
        assert!(!id.to_ascii_lowercase().contains("delete from"));
    }
    Ok(())
}

fn retention_batch(intents: Vec<RetentionDeleteIntent>) -> Result<RetentionDispatchBatch, String> {
    match retention_delete_dispatch_steps(
        RetentionDeleteDispatchInput {
            bytes_targeted: intents.iter().map(|intent| intent.estimated_bytes).sum(),
            intents,
        },
        &[],
    ) {
        StorageOutcome::Ok(batch) => Ok(batch),
        outcome => Err(format!("unexpected outcome {outcome:?}")),
    }
}

fn intent(
    resource_id: &str,
    resource_kind: CacheResourceKind,
    table_name: &str,
    estimated_bytes: u64,
) -> RetentionDeleteIntent {
    RetentionDeleteIntent {
        resource_id: resource_id.to_owned(),
        resource_kind,
        table_name: table_name.to_owned(),
        estimated_bytes,
    }
}

fn statement_ids(steps: &[RetentionDispatchStep]) -> Vec<&'static str> {
    steps.iter().map(|step| step.statement_id).collect()
}

fn first_param(step: &RetentionDispatchStep) -> Option<&str> {
    Some(step.resource_id.as_str())
}
