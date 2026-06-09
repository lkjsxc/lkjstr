#![doc = "Pure retention dispatch statement planning."]

use lkjstr_storage::{
    RetentionDeleteDispatchInput, RetentionDeleteDispatchOutput, RetentionDeleteIntent,
    RetentionDynamicProtection, RetentionStopReason, StorageOutcome, StorageProblemKind,
};

use crate::retention_routes::{DeleteRoute, delete_route};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetentionDispatchStep {
    pub statement_id: &'static str,
    pub resource_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RetentionDispatchBatch {
    pub steps: Vec<RetentionDispatchStep>,
    pub output: RetentionDeleteDispatchOutput,
}

pub fn retention_delete_dispatch_steps(
    input: RetentionDeleteDispatchInput,
    dynamic_protections: &[RetentionDynamicProtection],
) -> StorageOutcome<RetentionDispatchBatch> {
    let mut output = dispatch_output(input.bytes_targeted);
    let had_intents = !input.intents.is_empty();
    let mut steps = Vec::new();
    for intent in input.intents {
        if dynamically_protected(&intent, dynamic_protections) {
            output.skipped_dynamic_protected_count += 1;
            continue;
        }
        match delete_route(&intent) {
            DeleteRoute::Known(statements) => {
                output.attempted_count += 1;
                output.bytes_deleted_or_estimated = output
                    .bytes_deleted_or_estimated
                    .saturating_add(intent.estimated_bytes);
                push_delete_steps(&mut steps, statements, &intent.resource_id);
            }
            DeleteRoute::Protected => {
                output.skipped_protected_count += 1;
                output
                    .problems
                    .push(StorageProblemKind::PressureProtectedOnly);
            }
            DeleteRoute::Unknown => output
                .problems
                .push(StorageProblemKind::PressureCompactionError),
        }
    }
    output.deleted_count = output.attempted_count;
    output.stop_reason = dispatch_stop_reason(&output, had_intents);
    StorageOutcome::Ok(RetentionDispatchBatch { steps, output })
}

fn dispatch_output(bytes_targeted: u64) -> RetentionDeleteDispatchOutput {
    RetentionDeleteDispatchOutput {
        attempted_count: 0,
        deleted_count: 0,
        skipped_protected_count: 0,
        skipped_dynamic_protected_count: 0,
        bytes_targeted,
        bytes_deleted_or_estimated: 0,
        stop_reason: None,
        problems: Vec::new(),
    }
}

fn dynamically_protected(
    intent: &RetentionDeleteIntent,
    dynamic_protections: &[RetentionDynamicProtection],
) -> bool {
    dynamic_protections.iter().any(|item| {
        item.resource_kind == intent.resource_kind && item.resource_id == intent.resource_id
    })
}

fn push_delete_steps(
    steps: &mut Vec<RetentionDispatchStep>,
    statements: &'static [&'static str],
    resource_id: &str,
) {
    for statement_id in statements {
        steps.push(step(statement_id, resource_id));
    }
    steps.push(step("cache_ledger.delete", resource_id));
}

fn step(statement_id: &'static str, resource_id: &str) -> RetentionDispatchStep {
    RetentionDispatchStep {
        statement_id,
        resource_id: resource_id.to_owned(),
    }
}

fn dispatch_stop_reason(
    output: &RetentionDeleteDispatchOutput,
    had_intents: bool,
) -> Option<RetentionStopReason> {
    if output
        .problems
        .contains(&StorageProblemKind::PressureCompactionError)
    {
        Some(RetentionStopReason::CompactionError)
    } else if output.attempted_count > 0 {
        None
    } else if output.skipped_protected_count > 0 {
        Some(RetentionStopReason::ProtectedOnly)
    } else if had_intents || output.skipped_dynamic_protected_count == 0 {
        Some(RetentionStopReason::NoPrunableCandidates)
    } else {
        None
    }
}
