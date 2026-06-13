use std::collections::BTreeMap;

use lkjstr_app::DiscoveryRouteOutcome;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum UserTimelineRelayOutcome {
    Succeeded,
    NoEvent,
    Failed,
    AuthRequired,
    RateLimited,
    TimedOut,
}

impl UserTimelineRelayOutcome {
    pub(crate) fn from_closed_message(message: &str) -> Self {
        let message = message.trim().to_ascii_lowercase();
        if has_prefix(&message, "auth-required") {
            return Self::AuthRequired;
        }
        if has_prefix(&message, "rate-limited") {
            return Self::RateLimited;
        }
        Self::Failed
    }

    pub(crate) const fn discovery_outcome(self) -> DiscoveryRouteOutcome {
        match self {
            Self::Succeeded => DiscoveryRouteOutcome::Succeeded,
            Self::AuthRequired => DiscoveryRouteOutcome::AuthRequired,
            Self::RateLimited => DiscoveryRouteOutcome::RateLimited,
            Self::NoEvent | Self::Failed | Self::TimedOut => DiscoveryRouteOutcome::Failed,
        }
    }

    pub(crate) const fn needs_diagnostic(self) -> bool {
        !matches!(self, Self::Succeeded)
    }

    pub(crate) fn diagnostic_message(self, label: &str, relay: &str) -> String {
        let detail = match self {
            Self::Succeeded => "returned a public follow-list event",
            Self::NoEvent => "ended without a public follow-list event",
            Self::Failed => "failed before returning a public follow-list event",
            Self::AuthRequired => "requires relay authentication before reading the public follow-list",
            Self::RateLimited => "rate limited the public follow-list request",
            Self::TimedOut => "timed out before returning a public follow-list event",
        };
        format!("{label} {relay} {detail}. Retry is available.")
    }
}

pub(crate) fn relay_outcome_for(
    relay: &str,
    outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
) -> UserTimelineRelayOutcome {
    outcomes
        .get(relay)
        .copied()
        .unwrap_or(UserTimelineRelayOutcome::Failed)
}

pub(crate) fn discovery_outcome_for_relays<'a>(
    relays: impl IntoIterator<Item = &'a str>,
    outcomes: &BTreeMap<String, UserTimelineRelayOutcome>,
) -> DiscoveryRouteOutcome {
    relays
        .into_iter()
        .map(|relay| relay_outcome_for(relay, outcomes).discovery_outcome())
        .fold(DiscoveryRouteOutcome::Failed, strongest)
}

fn strongest(left: DiscoveryRouteOutcome, right: DiscoveryRouteOutcome) -> DiscoveryRouteOutcome {
    match (left, right) {
        (DiscoveryRouteOutcome::Succeeded, _) | (_, DiscoveryRouteOutcome::Succeeded) => {
            DiscoveryRouteOutcome::Succeeded
        }
        (DiscoveryRouteOutcome::AuthRequired, _) | (_, DiscoveryRouteOutcome::AuthRequired) => {
            DiscoveryRouteOutcome::AuthRequired
        }
        (DiscoveryRouteOutcome::RateLimited, _) | (_, DiscoveryRouteOutcome::RateLimited) => {
            DiscoveryRouteOutcome::RateLimited
        }
        _ => DiscoveryRouteOutcome::Failed,
    }
}

fn has_prefix(message: &str, prefix: &str) -> bool {
    message == prefix || message.starts_with(&format!("{prefix}:"))
}
