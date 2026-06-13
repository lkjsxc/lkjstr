use std::collections::BTreeMap;

use lkjstr_app::UserTimelineFeedDiagnosticInput;
use lkjstr_relays::AuthorRelayRoute;

use crate::{
    user_timeline_discovery_view::route_label,
    user_timeline_host_view::diagnostic,
    user_timeline_relay_outcome::{UserTimelineRelayOutcome, relay_outcome_for},
};

pub(crate) fn relay_diagnostics(
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    relay_outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
) -> Vec<UserTimelineFeedDiagnosticInput> {
    let mut diagnostics: Vec<_> = selected_relays
        .iter()
        .enumerate()
        .filter_map(|(index, relay)| {
            relay_diagnostic("selected-relay", index, "Selected relay", relay, relay_outcomes)
        })
        .collect();
    diagnostics.extend(author_routes.iter().enumerate().filter_map(|(index, route)| {
        let label = format!("{} route", route_label(route.source));
        relay_diagnostic(
            "author-route",
            index,
            &label,
            &route.relay_url,
            relay_outcomes,
        )
    }));
    diagnostics
}

fn relay_diagnostic(
    id_prefix: &str,
    index: usize,
    label: &str,
    relay: &str,
    outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
) -> Option<UserTimelineFeedDiagnosticInput> {
    let outcome = relay_outcome_for(relay, outcomes);
    outcome.needs_diagnostic().then(|| {
        diagnostic(
            &format!("{id_prefix}-{index}"),
            &outcome.diagnostic_message(label, relay),
        )
    })
}
