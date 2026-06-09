use lkjstr_storage::{
    CacheResourceKind, RetentionDeleteDispatchInput, RetentionDeleteIntent,
    RetentionDynamicProtection, RetentionStopReason, StorageOperation, StorageOutcome,
    StorageProblem, StorageProblemKind,
};
use lkjstr_web::retention_dispatch::{
    retention_delete_dispatch_finish, retention_delete_dispatch_steps,
};

#[test]
fn retention_batch_failure_maps_to_storage_outcome() -> Result<(), String> {
    let output = dispatch_output(vec![intent(
        "event-1",
        CacheResourceKind::NostrEvent,
        "events",
    )])?;
    let problem = StorageProblem::with_kind(
        StorageOperation::Compaction,
        "retention",
        StorageProblemKind::QuotaOrWriteFailed,
        "batch-1",
    );
    match retention_delete_dispatch_finish(StorageOutcome::Quota(problem.clone()), output) {
        StorageOutcome::Quota(actual) => assert_eq!(actual, problem),
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    }
    Ok(())
}

#[test]
fn retention_unsupported_resource_kind_is_compaction_problem() -> Result<(), String> {
    let output = dispatch_output(vec![intent(
        "tab-1",
        CacheResourceKind::TabState,
        "tab_states",
    )])?;
    assert_eq!(
        output.stop_reason,
        Some(RetentionStopReason::CompactionError)
    );
    assert!(
        output
            .problems
            .contains(&StorageProblemKind::PressureCompactionError)
    );
    Ok(())
}

#[test]
fn retention_dynamic_only_dispatch_has_exact_stop_reason() -> Result<(), String> {
    let dynamic = [RetentionDynamicProtection {
        resource_kind: CacheResourceKind::FeedCursor,
        resource_id: "cursor-1".to_owned(),
        reason: "visible-feed".to_owned(),
    }];
    let input = RetentionDeleteDispatchInput {
        intents: vec![intent(
            "cursor-1",
            CacheResourceKind::FeedCursor,
            "feed_cursors",
        )],
        bytes_targeted: 1,
    };
    let batch = match retention_delete_dispatch_steps(input, &dynamic) {
        StorageOutcome::Ok(batch) => batch,
        outcome => return Err(format!("unexpected outcome {outcome:?}")),
    };
    assert!(batch.steps.is_empty());
    assert_eq!(
        batch.output.stop_reason,
        Some(RetentionStopReason::NoPrunableCandidates)
    );
    Ok(())
}

fn dispatch_output(
    intents: Vec<RetentionDeleteIntent>,
) -> Result<lkjstr_storage::RetentionDeleteDispatchOutput, String> {
    match retention_delete_dispatch_steps(
        RetentionDeleteDispatchInput {
            bytes_targeted: intents.len() as u64,
            intents,
        },
        &[],
    ) {
        StorageOutcome::Ok(batch) => Ok(batch.output),
        outcome => Err(format!("unexpected outcome {outcome:?}")),
    }
}

fn intent(
    resource_id: &str,
    resource_kind: CacheResourceKind,
    table_name: &str,
) -> RetentionDeleteIntent {
    RetentionDeleteIntent {
        resource_id: resource_id.to_owned(),
        resource_kind,
        table_name: table_name.to_owned(),
        estimated_bytes: 1,
    }
}
