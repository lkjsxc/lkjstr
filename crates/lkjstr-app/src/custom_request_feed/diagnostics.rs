use crate::{
    CustomRequestLimitClamp, CustomRequestRunPlan, FeedDiagnosticSeverity, FeedStateRow,
    custom_request::{CustomRequest, CustomRequestRelayLimitClamp},
    diagnostic_state_row,
};

pub(super) fn custom_request_diagnostic_rows(
    plan: &Option<CustomRequestRunPlan>,
) -> Vec<FeedStateRow> {
    let Some(request) = plan.as_ref().and_then(|plan| plan.request.as_ref()) else {
        return Vec::new();
    };
    if request.limit_clamps.is_empty() && request.relay_limit_clamps.is_empty() {
        return Vec::new();
    }
    vec![diagnostic_state_row(
        "custom-request",
        "effective-filters",
        FeedDiagnosticSeverity::Info,
        &effective_filter_message(request),
    )]
}

fn effective_filter_message(request: &CustomRequest) -> String {
    let mut items = request
        .limit_clamps
        .iter()
        .map(clamp_message)
        .collect::<Vec<_>>();
    items.extend(request.relay_limit_clamps.iter().map(relay_clamp_message));
    format!("Effective outbound filters: {}.", items.join("; "))
}

fn clamp_message(clamp: &CustomRequestLimitClamp) -> String {
    format!(
        "filter {} limit {} after app policy clamp from {}",
        clamp.filter_index + 1,
        clamp.effective_limit,
        clamp.original_limit
    )
}

fn relay_clamp_message(clamp: &CustomRequestRelayLimitClamp) -> String {
    format!(
        "{} filter {} limit {} after NIP-11 max_limit clamp from {}",
        clamp.relay_url,
        clamp.filter_index + 1,
        clamp.effective_limit,
        clamp.original_limit
    )
}
