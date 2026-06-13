#![doc = "Route-plan reducer helpers."]

use std::collections::BTreeSet;

use lkjstr_protocol::normalize_relay_url;

use super::{RoutePlanDiagnostic, RoutePlanDiagnosticKind, RoutePlanSurface};

#[must_use]
pub(super) fn surface_allows_author_routes(surface: RoutePlanSurface) -> bool {
    matches!(
        surface,
        RoutePlanSurface::Home
            | RoutePlanSurface::Profile
            | RoutePlanSurface::UserTimeline
            | RoutePlanSurface::Thread
            | RoutePlanSurface::Notifications
            | RoutePlanSurface::AuthorContext
    )
}

#[must_use]
pub(super) fn capped_authors(authors: &[String], max_authors: usize) -> Vec<String> {
    let mut values = authors.to_vec();
    values.sort();
    values.dedup();
    values.truncate(max_authors);
    values
}

#[must_use]
pub(super) fn normalized_set(relays: &[String]) -> BTreeSet<String> {
    relays
        .iter()
        .filter_map(|relay| normalize_relay_url(relay))
        .collect()
}

#[must_use]
pub(super) fn diagnostic(
    kind: RoutePlanDiagnosticKind,
    relay_url: Option<String>,
    author: Option<String>,
) -> RoutePlanDiagnostic {
    RoutePlanDiagnostic {
        kind,
        relay_url,
        author,
    }
}
