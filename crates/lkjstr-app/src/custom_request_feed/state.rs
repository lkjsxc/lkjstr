use crate::{
    CustomRequestRunPlan, CustomRequestRunStatus, FeedFooterRow, FeedFooterState, FeedStateRow,
    footer_row_from_window, unavailable_state_row,
};

use super::{CustomRequestFeedSourceState, CustomRequestFeedStatus};

type FeedStateParts = (
    CustomRequestFeedStatus,
    Option<crate::QueryDemandInput>,
    Vec<String>,
    FeedFooterRow,
);

pub(super) fn custom_request_state(
    plan: &Option<CustomRequestRunPlan>,
    source: &CustomRequestFeedSourceState,
    window: &crate::FeedWindowState,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> FeedStateParts {
    match (plan, source) {
        (_, CustomRequestFeedSourceState::Planning) => idle_like(
            CustomRequestFeedStatus::Planning,
            feed_id,
            FeedFooterState::Loading,
        ),
        (_, CustomRequestFeedSourceState::Canceled) => {
            state_rows.push(unavailable_state_row(
                "custom-request-canceled",
                "custom-request",
                "Custom Request canceled.",
                true,
            ));
            idle_like(
                CustomRequestFeedStatus::Canceled,
                feed_id,
                FeedFooterState::TerminalEmpty,
            )
        }
        (
            _,
            CustomRequestFeedSourceState::Unavailable {
                reason,
                retry_available,
            },
        ) => {
            state_rows.push(unavailable_state_row(
                "custom-request-unavailable",
                "custom-request",
                reason,
                *retry_available,
            ));
            idle_like(
                CustomRequestFeedStatus::Unavailable,
                feed_id,
                FeedFooterState::ConfigurationUnavailable,
            )
        }
        (None, _) => idle_like(
            CustomRequestFeedStatus::Idle,
            feed_id,
            FeedFooterState::TerminalEmpty,
        ),
        (Some(plan), _) if plan.status == CustomRequestRunStatus::Invalid => {
            state_rows.push(invalid_row(plan));
            plan_like(
                CustomRequestFeedStatus::Invalid,
                plan,
                feed_id,
                FeedFooterState::ConfigurationUnavailable,
            )
        }
        (Some(plan), _) if plan.status == CustomRequestRunStatus::NoRelay => {
            state_rows.push(unavailable_state_row(
                "custom-request-no-relay",
                "custom-request",
                "No enabled relay is available for this request.",
                false,
            ));
            plan_like(
                CustomRequestFeedStatus::NoRelay,
                plan,
                feed_id,
                FeedFooterState::ConfigurationUnavailable,
            )
        }
        (
            Some(plan),
            CustomRequestFeedSourceState::Partial {
                reason,
                retry_available,
            },
        ) => partial_like(plan, reason, *retry_available, window, feed_id, state_rows),
        (Some(plan), CustomRequestFeedSourceState::Complete) => (
            CustomRequestFeedStatus::Ready,
            plan.demand.clone(),
            plan.relays.clone(),
            complete_footer(feed_id, window),
        ),
        (Some(plan), _) => (
            CustomRequestFeedStatus::Ready,
            plan.demand.clone(),
            plan.relays.clone(),
            footer_row_from_window(feed_id, window),
        ),
    }
}

fn partial_like(
    plan: &CustomRequestRunPlan,
    reason: &str,
    retry_available: bool,
    window: &crate::FeedWindowState,
    feed_id: &str,
    state_rows: &mut Vec<FeedStateRow>,
) -> FeedStateParts {
    state_rows.push(unavailable_state_row(
        "custom-request-partial",
        "custom-request",
        reason,
        retry_available,
    ));
    let footer = if window.has_older && !window.visible_events().is_empty() {
        footer_row_from_window(feed_id, window)
    } else {
        crate::footer_row(feed_id, FeedFooterState::Partial)
    };
    (
        CustomRequestFeedStatus::Partial,
        plan.demand.clone(),
        plan.relays.clone(),
        footer,
    )
}

fn complete_footer(feed_id: &str, window: &crate::FeedWindowState) -> FeedFooterRow {
    let state = if window.visible_events().is_empty() {
        FeedFooterState::TerminalEmpty
    } else if window.has_older {
        FeedFooterState::OlderLoadReady
    } else {
        FeedFooterState::TerminalWithRows
    };
    crate::footer_row(feed_id, state)
}

fn idle_like(
    status: CustomRequestFeedStatus,
    feed_id: &str,
    footer: FeedFooterState,
) -> FeedStateParts {
    (status, None, Vec::new(), crate::footer_row(feed_id, footer))
}

fn plan_like(
    status: CustomRequestFeedStatus,
    plan: &CustomRequestRunPlan,
    feed_id: &str,
    footer: FeedFooterState,
) -> FeedStateParts {
    (
        status,
        None,
        plan.relays.clone(),
        crate::footer_row(feed_id, footer),
    )
}

fn invalid_row(plan: &CustomRequestRunPlan) -> FeedStateRow {
    let detail = plan
        .error
        .as_ref()
        .map(|error| format!("Invalid request: {:?}.", error.kind))
        .unwrap_or_else(|| "Invalid request.".to_owned());
    unavailable_state_row("custom-request-invalid", "custom-request", &detail, false)
}
