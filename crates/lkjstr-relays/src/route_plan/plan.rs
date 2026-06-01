#![doc = "Pure route-plan reducer."]

use std::collections::{BTreeMap, BTreeSet};

use lkjstr_protocol::normalize_relay_url;

use super::plan_tail::{capped_authors, diagnostic, normalized_set, surface_allows_author_routes};
use super::{
    AuthorRelayRoute, RelayRoutePlan, RoutePlanDiagnostic, RoutePlanDiagnosticKind, RoutePlanGroup,
    RoutePlanGroupSource, RoutePlanInput,
};

#[must_use]
pub fn plan_relay_routes(input: RoutePlanInput) -> RelayRoutePlan {
    let disabled = normalized_set(&input.disabled_relays);
    let mut diagnostics = Vec::new();
    let selected = normalize_allowed(&input.selected_relays, &disabled, None, &mut diagnostics);
    let mut groups = Vec::new();
    if surface_allows_author_routes(input.surface) {
        groups.extend(author_route_groups(&input, &disabled, &mut diagnostics));
    } else if !input.author_routes.is_empty() {
        diagnostics.push(RoutePlanDiagnostic {
            kind: RoutePlanDiagnosticKind::SurfaceRoutesIgnored,
            relay_url: None,
            author: None,
        });
    }
    if !selected.is_empty() {
        groups.push(RoutePlanGroup {
            key: "selected:fallback".to_owned(),
            relays: selected,
            authors: capped_authors(&input.authors, input.max_authors_per_group),
            source: RoutePlanGroupSource::SelectedFallback,
        });
    }
    RelayRoutePlan {
        groups,
        diagnostics,
    }
}

fn author_route_groups(
    input: &RoutePlanInput,
    disabled: &BTreeSet<String>,
    diagnostics: &mut Vec<RoutePlanDiagnostic>,
) -> Vec<RoutePlanGroup> {
    let authors = capped_authors(&input.authors, input.max_targeted_groups);
    let allowed_authors = authors.iter().cloned().collect::<BTreeSet<_>>();
    let mut by_author: BTreeMap<String, Vec<AuthorRelayRoute>> = BTreeMap::new();
    for route in &input.author_routes {
        if !allowed_authors.contains(&route.author) {
            continue;
        }
        by_author
            .entry(route.author.clone())
            .or_default()
            .push(route.clone());
    }
    authors
        .iter()
        .filter_map(|author| author_group(author, &by_author, input, disabled, diagnostics))
        .collect()
}

fn author_group(
    author: &str,
    by_author: &BTreeMap<String, Vec<AuthorRelayRoute>>,
    input: &RoutePlanInput,
    disabled: &BTreeSet<String>,
    diagnostics: &mut Vec<RoutePlanDiagnostic>,
) -> Option<RoutePlanGroup> {
    let mut candidates = match by_author.get(author) {
        Some(routes) => routes.clone(),
        None => Vec::new(),
    };
    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.relay_url.cmp(&right.relay_url))
    });
    let mut seen = BTreeSet::new();
    let relays = candidates
        .iter()
        .filter_map(|route| normalize_candidate(route, disabled, diagnostics))
        .filter(|relay| seen.insert(relay.clone()))
        .take(input.max_route_relays_per_author)
        .collect::<Vec<_>>();
    if relays.is_empty() {
        return None;
    }
    Some(RoutePlanGroup {
        key: format!("author:{author}"),
        relays,
        authors: vec![author.to_owned()],
        source: RoutePlanGroupSource::AuthorRoute,
    })
}

fn normalize_candidate(
    route: &AuthorRelayRoute,
    disabled: &BTreeSet<String>,
    diagnostics: &mut Vec<RoutePlanDiagnostic>,
) -> Option<String> {
    let Some(relay) = normalize_relay_url(&route.relay_url) else {
        diagnostics.push(diagnostic(
            RoutePlanDiagnosticKind::InvalidRelayIgnored,
            Some(route.relay_url.clone()),
            Some(route.author.clone()),
        ));
        return None;
    };
    if disabled.contains(&relay) {
        diagnostics.push(diagnostic(
            RoutePlanDiagnosticKind::DisabledRelayExcluded,
            Some(relay),
            Some(route.author.clone()),
        ));
        return None;
    }
    Some(relay)
}

fn normalize_allowed(
    relays: &[String],
    disabled: &BTreeSet<String>,
    author: Option<String>,
    diagnostics: &mut Vec<RoutePlanDiagnostic>,
) -> Vec<String> {
    let mut values = Vec::new();
    for relay in relays {
        match normalize_relay_url(relay) {
            Some(normalized) if disabled.contains(&normalized) => {
                diagnostics.push(diagnostic(
                    RoutePlanDiagnosticKind::DisabledRelayExcluded,
                    Some(normalized),
                    author.clone(),
                ));
            }
            Some(normalized) => values.push(normalized),
            None => diagnostics.push(diagnostic(
                RoutePlanDiagnosticKind::InvalidRelayIgnored,
                Some(relay.clone()),
                author.clone(),
            )),
        }
    }
    values.sort();
    values.dedup();
    values
}
