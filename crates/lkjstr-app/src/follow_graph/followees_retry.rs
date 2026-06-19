use crate::follow_graph::{
    FollowListSummary, FolloweesDiagnostic, FolloweesView, TargetFollowListState,
    followees_view_from_summary,
};

#[must_use]
pub fn followees_retryable_failure_view(
    owner: &str,
    target_pubkey: Option<String>,
    relays: &[String],
) -> FolloweesView {
    let mut view = followees_view_from_summary(
        owner,
        target_pubkey,
        TargetFollowListState::PartialFailure,
        empty_summary(),
    );
    view.message = retryable_failure_message(relays.len());
    view.diagnostics = selected_relay_diagnostics(relays);
    view
}

fn retryable_failure_message(relay_count: usize) -> String {
    format!(
        "Follow-list discovery incomplete after {relay_count} selected relay read. Retry available."
    )
}

fn selected_relay_diagnostics(relays: &[String]) -> Vec<FolloweesDiagnostic> {
    relays
        .iter()
        .enumerate()
        .map(|(index, relay)| FolloweesDiagnostic {
            row_id: format!("followees-diagnostic:selected:{index}"),
            relay: Some(relay.clone()),
            message: "Selected relay did not return a follow list before the read ended."
                .to_owned(),
            retry_available: true,
        })
        .collect()
}

fn empty_summary() -> FollowListSummary {
    FollowListSummary {
        entries: Vec::new(),
        following_count: 0,
    }
}
