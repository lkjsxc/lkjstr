#![doc = "Cache ledger resource and owner kind strings."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CacheOwnerKind {
    Event,
    Notification,
    FeedPage,
    FeedCoverage,
    FeedScanHint,
    TabSnapshot,
    RelayDiagnostic,
    RelayInformation,
    RelaySuggestion,
    RouteEvidence,
    Job,
}

impl CacheOwnerKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Event => "event",
            Self::Notification => "notification",
            Self::FeedPage => "feed-page",
            Self::FeedCoverage => "feed-coverage",
            Self::FeedScanHint => "feed-scan-hint",
            Self::TabSnapshot => "tab-snapshot",
            Self::RelayDiagnostic => "relay-diagnostic",
            Self::RelayInformation => "relay-information",
            Self::RelaySuggestion => "relay-suggestion",
            Self::RouteEvidence => "route-evidence",
            Self::Job => "job",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CacheResourceKind {
    NostrEvent,
    NotificationRecord,
    FeedCursor,
    CoverageRow,
    ScanHint,
    TabState,
    RelaySummary,
    RelayInfo,
    RelayListSuggestion,
    AuthorRelayRoute,
    JobRecord,
}

impl CacheResourceKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NostrEvent => "nostr-event",
            Self::NotificationRecord => "notification-record",
            Self::FeedCursor => "feed-cursor",
            Self::CoverageRow => "coverage-row",
            Self::ScanHint => "scan-hint",
            Self::TabState => "tab-state",
            Self::RelaySummary => "relay-summary",
            Self::RelayInfo => "relay-info",
            Self::RelayListSuggestion => "relay-list-suggestion",
            Self::AuthorRelayRoute => "author-relay-route",
            Self::JobRecord => "job-record",
        }
    }
}
