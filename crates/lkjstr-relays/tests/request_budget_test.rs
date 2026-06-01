use lkjstr_protocol::NostrFilter;
use lkjstr_relays::{
    RequestBudgetInput, RequestBudgetPhase, RequestBudgetPurpose, RequestBudgetSurface,
    RequestBudgetWarningKind, RequestRelayLimits, apply_budget_to_filters,
    default_read_page_max_events, derive_request_budget, max_filter_limit,
    max_relay_subscription_id_length, merge_budgets_for_read, request_timeout_ms,
};

#[test]
fn missing_relay_metadata_uses_app_caps() {
    let budget = derive_request_budget(&input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(max_filter_limit() + 10),
    ));

    assert_eq!(budget.filter_limit, Some(max_filter_limit()));
    assert_eq!(
        budget.max_subscription_id_length,
        max_relay_subscription_id_length()
    );
    assert!(budget.max_subscriptions > 1000);
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::AppLimitClamped
    ));
}

#[test]
fn relay_max_limit_clamps_filter_limit() {
    let mut input = input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(100),
    );
    input.relay_limits = Some(RequestRelayLimits {
        max_limit: Some(25),
        max_subscription_id_length: Some(80),
        ..RequestRelayLimits::default()
    });

    let budget = derive_request_budget(&input);

    assert_eq!(budget.filter_limit, Some(25));
    assert_eq!(
        budget.max_subscription_id_length,
        max_relay_subscription_id_length()
    );
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::RelayLimitClamped
    ));
}

#[test]
fn relay_default_limit_warns_without_clamping() {
    let mut input = input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(40),
    );
    input.relay_limits = Some(RequestRelayLimits {
        default_limit: Some(20),
        ..RequestRelayLimits::default()
    });

    let budget = derive_request_budget(&input);

    assert_eq!(budget.filter_limit, Some(40));
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::RelayDefaultLimit
    ));
}

#[test]
fn live_without_requested_limit_keeps_filters_unlimited() {
    let budget = derive_request_budget(&input(
        RequestBudgetPhase::Live,
        Some(RequestBudgetPurpose::Feed),
        None,
    ));

    assert_eq!(budget.filter_limit, None);
    assert_eq!(budget.max_events, default_read_page_max_events());
}

#[test]
fn exact_event_lookup_uses_page_shape() {
    let mut input = input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::EventLookup),
        None,
    );
    input.exact_event_lookup = true;
    input.page_size = Some(3);

    let budget = derive_request_budget(&input);

    assert_eq!(budget.filter_limit, Some(3));
    assert_eq!(budget.max_events, 3);
}

#[test]
fn relay_policy_flags_create_warnings() {
    let mut input = input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(10),
    );
    input.relay_limits = Some(RequestRelayLimits {
        auth_required: true,
        payment_required: true,
        restricted_writes: true,
        min_pow_difficulty: Some(12),
        created_at_lower_limit: Some(1),
        ..RequestRelayLimits::default()
    });

    let budget = derive_request_budget(&input);

    assert!(has_warning(&budget, RequestBudgetWarningKind::AuthRequired));
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::PaymentRequired
    ));
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::RestrictedWrites
    ));
    assert!(has_warning(&budget, RequestBudgetWarningKind::PowRequired));
    assert!(has_warning(
        &budget,
        RequestBudgetWarningKind::CreatedAtBound
    ));
}

#[test]
fn budget_application_clamps_filter_limits() {
    let budget = derive_request_budget(&input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(5),
    ));
    let filters = vec![
        NostrFilter {
            limit: Some(20),
            ..NostrFilter::default()
        },
        NostrFilter::default(),
    ];

    let applied = apply_budget_to_filters(&filters, &budget);

    assert_eq!(applied.filters[0].limit, Some(5));
    assert_eq!(applied.filters[1].limit, Some(5));
}

#[test]
fn read_budget_merge_sums_events_and_keeps_timeout_floor() {
    let first = derive_request_budget(&input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(400),
    ));
    let second = derive_request_budget(&input(
        RequestBudgetPhase::Page,
        Some(RequestBudgetPurpose::Feed),
        Some(800),
    ));

    let merged = merge_budgets_for_read(&[first, second]);

    assert_eq!(merged.max_events, default_read_page_max_events());
    assert_eq!(merged.timeout_ms, request_timeout_ms());
}

fn input(
    phase: RequestBudgetPhase,
    purpose: Option<RequestBudgetPurpose>,
    requested_filter_limit: Option<u64>,
) -> RequestBudgetInput {
    RequestBudgetInput {
        surface: RequestBudgetSurface::Home,
        phase,
        direction: None,
        purpose,
        page_size: None,
        relay_url: "wss://relay.example/".to_owned(),
        filter_count: 1,
        requested_filter_limit,
        has_search_filter: false,
        exact_event_lookup: false,
        relay_limits: None,
    }
}

fn has_warning(budget: &lkjstr_relays::RequestBudget, kind: RequestBudgetWarningKind) -> bool {
    budget.warnings.iter().any(|warning| warning.kind == kind)
}
