use std::cmp::Ordering;

use super::{
    RetentionCandidate, RetentionDeleteIntent, RetentionDynamicProtection, RetentionPlan,
    RetentionPlanInput, RetentionPlanSummary, RetentionStopReason,
};

#[must_use]
pub fn plan_retention(input: RetentionPlanInput) -> RetentionPlan {
    let bytes_to_free = input.byte_target.bytes_to_free().unwrap_or(0);
    let mut summary = RetentionPlanSummary::new(&input, bytes_to_free);
    let mut intents = Vec::new();
    if can_select(&input, bytes_to_free) {
        let mut candidates = selectable_candidates(&input, &mut summary);
        candidates.sort_by(candidate_order);
        summary.prunable_candidate_count = candidates.len();
        for candidate in candidates {
            if summary.selected_bytes >= bytes_to_free {
                break;
            }
            summary.selected_bytes = summary.selected_bytes.saturating_add(candidate.byte_count);
            intents.push(delete_intent(candidate));
        }
    }
    summary.selected_count = intents.len();
    summary.target_met = bytes_to_free == 0 || summary.selected_bytes >= bytes_to_free;
    let stop_reason = retention_stop_reason(&input, &summary);
    RetentionPlan {
        intents,
        summary,
        stop_reason,
    }
}

#[must_use]
pub fn candidate_is_prunable(candidate: &RetentionCandidate) -> bool {
    candidate.ledger_backed
        && candidate.recoverable
        && !candidate.protected
        && candidate.byte_count > 0
}

#[must_use]
pub fn candidate_is_dynamically_protected(
    candidate: &RetentionCandidate,
    protections: &[RetentionDynamicProtection],
) -> bool {
    protections.iter().any(|protection| {
        protection.resource_kind == candidate.resource_kind
            && protection.resource_id == candidate.resource_id
    })
}

#[must_use]
pub fn retention_stop_reason(
    input: &RetentionPlanInput,
    summary: &RetentionPlanSummary,
) -> Option<RetentionStopReason> {
    if input.compaction_error {
        return Some(RetentionStopReason::CompactionError);
    }
    if !input.storage_api_available {
        return Some(RetentionStopReason::StorageApiUnavailable);
    }
    if !input.inventory_complete {
        return Some(RetentionStopReason::InventoryIncomplete);
    }
    if input.byte_target.usage_bytes.is_none() {
        return Some(RetentionStopReason::UnknownUnownedUsage);
    }
    if summary.target_met {
        return None;
    }
    if input.quota_pressure {
        return Some(RetentionStopReason::QuotaPressure);
    }
    if input.unknown_unowned_usage_bytes > 0 {
        return Some(RetentionStopReason::UnknownUnownedUsage);
    }
    if summary.prunable_candidate_count == 0
        && summary.skipped_protected_count + summary.skipped_dynamic_protected_count > 0
    {
        return Some(RetentionStopReason::ProtectedOnly);
    }
    Some(RetentionStopReason::NoPrunableCandidates)
}

fn can_select(input: &RetentionPlanInput, bytes_to_free: u64) -> bool {
    bytes_to_free > 0
        && input.storage_api_available
        && input.inventory_complete
        && input.byte_target.usage_bytes.is_some()
        && !input.compaction_error
}

fn selectable_candidates<'a>(
    input: &'a RetentionPlanInput,
    summary: &mut RetentionPlanSummary,
) -> Vec<&'a RetentionCandidate> {
    input
        .candidates
        .iter()
        .filter(|candidate| keep_candidate(candidate, &input.dynamic_protections, summary))
        .collect()
}

fn keep_candidate(
    candidate: &RetentionCandidate,
    protections: &[RetentionDynamicProtection],
    summary: &mut RetentionPlanSummary,
) -> bool {
    if candidate.protected {
        summary.skipped_protected_count += 1;
        return false;
    }
    if !candidate_is_prunable(candidate) {
        summary.skipped_unowned_count += 1;
        return false;
    }
    if candidate_is_dynamically_protected(candidate, protections) {
        summary.skipped_dynamic_protected_count += 1;
        return false;
    }
    true
}

fn candidate_order(left: &&RetentionCandidate, right: &&RetentionCandidate) -> Ordering {
    left.score
        .cmp(&right.score)
        .then_with(|| left.updated_at_ms.cmp(&right.updated_at_ms))
        .then_with(|| {
            left.resource_kind
                .as_str()
                .cmp(right.resource_kind.as_str())
        })
        .then_with(|| left.resource_id.cmp(&right.resource_id))
}

fn delete_intent(candidate: &RetentionCandidate) -> RetentionDeleteIntent {
    RetentionDeleteIntent {
        resource_id: candidate.resource_id.clone(),
        resource_kind: candidate.resource_kind,
        table_name: candidate.table_name.clone(),
        estimated_bytes: candidate.byte_count,
    }
}
