#![doc = "Request-budget derivation from app caps and relay limits."]

use crate::max_relay_subscription_id_length;

use super::{
    RequestBudget, RequestBudgetInput, RequestBudgetPhase, RequestBudgetWarning,
    RequestBudgetWarningKind, RequestBudgetWarningValue, RequestRelayLimits, app_filter_cap,
    default_read_page_max_events, intended_filter_limit, request_timeout_ms,
};

#[must_use]
pub fn derive_request_budget(input: &RequestBudgetInput) -> RequestBudget {
    let mut warnings = policy_warnings(input.relay_limits.as_ref());
    let intended = intended_filter_limit(input);
    let filter_limit = derive_filter_limit(input, intended, &mut warnings);
    let max_events = derive_max_events(input, filter_limit, intended);
    RequestBudget {
        relay_url: input.relay_url.clone(),
        filter_limit,
        max_events,
        timeout_ms: request_timeout_ms(),
        max_message_length: input
            .relay_limits
            .as_ref()
            .and_then(|limits| limits.max_message_length),
        max_subscriptions: input
            .relay_limits
            .as_ref()
            .and_then(|limits| limits.max_subscriptions)
            .map_or(usize::MAX, |max_subscriptions| max_subscriptions),
        max_subscription_id_length: max_subscription_id_length(input.relay_limits.as_ref()),
        warnings,
    }
}

fn derive_filter_limit(
    input: &RequestBudgetInput,
    intended: u64,
    warnings: &mut Vec<RequestBudgetWarning>,
) -> Option<u64> {
    if input.phase == RequestBudgetPhase::Live && input.requested_filter_limit.is_none() {
        return None;
    }
    let app_cap = app_filter_cap(input.purpose);
    let app_limited = intended.min(app_cap);
    if app_limited < intended {
        warnings.push(limit_warning(
            RequestBudgetWarningKind::AppLimitClamped,
            app_cap,
        ));
    }
    let relay_cap = input
        .relay_limits
        .as_ref()
        .and_then(|limits| limits.max_limit);
    let relay_limited = relay_cap.map_or(app_limited, |cap| app_limited.min(cap));
    if relay_limited < app_limited {
        warnings.push(limit_warning(
            RequestBudgetWarningKind::RelayLimitClamped,
            relay_limited,
        ));
    }
    if input
        .relay_limits
        .as_ref()
        .and_then(|limits| limits.default_limit)
        .is_some_and(|relay_default| relay_limited > relay_default)
    {
        warnings.push(RequestBudgetWarning {
            kind: RequestBudgetWarningKind::RelayDefaultLimit,
            message: "explicit limit exceeds relay default".to_owned(),
            value: input
                .relay_limits
                .as_ref()
                .and_then(|limits| limits.default_limit)
                .map(RequestBudgetWarningValue::Number),
        });
    }
    Some(relay_limited.max(1))
}

fn derive_max_events(input: &RequestBudgetInput, filter_limit: Option<u64>, intended: u64) -> u64 {
    let filters = usize_to_u64(input.filter_count).max(1);
    let page = input.page_size.map_or(intended, |page| page).max(1);
    if input.phase == RequestBudgetPhase::Live {
        return default_read_page_max_events();
    }
    if input.exact_event_lookup {
        return default_read_page_max_events().min(page.max(intended));
    }
    let per_filter = filter_limit.map_or(intended, |limit| limit);
    let requested = per_filter.saturating_mul(filters).saturating_add(page);
    default_read_page_max_events().min(page.max(requested))
}

fn max_subscription_id_length(limits: Option<&RequestRelayLimits>) -> usize {
    let app_cap = max_relay_subscription_id_length();
    limits
        .and_then(|limits| limits.max_subscription_id_length)
        .map_or(app_cap, |relay_cap| relay_cap.min(app_cap))
}

fn policy_warnings(limits: Option<&RequestRelayLimits>) -> Vec<RequestBudgetWarning> {
    let Some(limits) = limits else {
        return Vec::new();
    };
    [
        limits.auth_required.then_some(policy_warning(
            RequestBudgetWarningKind::AuthRequired,
            "relay advertises read authentication",
        )),
        limits.payment_required.then_some(policy_warning(
            RequestBudgetWarningKind::PaymentRequired,
            "relay advertises payment policy",
        )),
        limits.restricted_writes.then_some(policy_warning(
            RequestBudgetWarningKind::RestrictedWrites,
            "relay advertises restricted writes",
        )),
        limits
            .min_pow_difficulty
            .is_some()
            .then_some(policy_warning(
                RequestBudgetWarningKind::PowRequired,
                "relay advertises proof-of-work policy",
            )),
        created_at_bound(limits).then_some(policy_warning(
            RequestBudgetWarningKind::CreatedAtBound,
            "relay advertises created-at bounds",
        )),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn created_at_bound(limits: &RequestRelayLimits) -> bool {
    limits.created_at_lower_limit.is_some() || limits.created_at_upper_limit.is_some()
}

fn limit_warning(kind: RequestBudgetWarningKind, value: u64) -> RequestBudgetWarning {
    RequestBudgetWarning {
        kind,
        message: "request limit was clamped".to_owned(),
        value: Some(RequestBudgetWarningValue::Number(value)),
    }
}

fn policy_warning(kind: RequestBudgetWarningKind, message: &str) -> RequestBudgetWarning {
    RequestBudgetWarning {
        kind,
        message: message.to_owned(),
        value: None,
    }
}

fn usize_to_u64(value: usize) -> u64 {
    value as u64
}
