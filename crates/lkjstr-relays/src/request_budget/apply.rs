#![doc = "Request-budget application helpers."]

use lkjstr_protocol::NostrFilter;

use super::{BudgetedFilters, MergedReadBudget, RequestBudget, default_read_page_max_events};

#[must_use]
pub fn apply_budget_to_filters(filters: &[NostrFilter], budget: &RequestBudget) -> BudgetedFilters {
    let Some(filter_limit) = budget.filter_limit else {
        return BudgetedFilters {
            filters: filters.to_vec(),
            warnings: budget.warnings.clone(),
        };
    };
    BudgetedFilters {
        filters: filters
            .iter()
            .map(|filter| budget_filter(filter, filter_limit))
            .collect(),
        warnings: budget.warnings.clone(),
    }
}

#[must_use]
pub fn merge_budgets_for_read(budgets: &[RequestBudget]) -> MergedReadBudget {
    let max_events = budgets
        .iter()
        .fold(0_u64, |sum, budget| sum.saturating_add(budget.max_events))
        .min(default_read_page_max_events());
    let timeout_ms = budgets
        .iter()
        .map(|budget| budget.timeout_ms)
        .max()
        .map_or(5000, |timeout| timeout.max(5000));
    MergedReadBudget {
        max_events,
        timeout_ms,
    }
}

fn budget_filter(filter: &NostrFilter, filter_limit: u64) -> NostrFilter {
    let mut next = filter.clone();
    next.limit = Some(
        filter
            .limit
            .map_or(filter_limit, |limit| limit.min(filter_limit)),
    );
    next
}
