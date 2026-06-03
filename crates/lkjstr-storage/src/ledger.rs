#![doc = "Cache ledger resource ownership manifest."]

use crate::resource::{CacheOwnerKind, CacheResourceKind};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LedgerResourceSpec {
    pub resource_kind: CacheResourceKind,
    pub owner_kind: CacheOwnerKind,
    pub owning_table: &'static str,
    pub event_owned: bool,
}

const fn resource(
    resource_kind: CacheResourceKind,
    owner_kind: CacheOwnerKind,
    owning_table: &'static str,
    event_owned: bool,
) -> LedgerResourceSpec {
    LedgerResourceSpec {
        resource_kind,
        owner_kind,
        owning_table,
        event_owned,
    }
}

pub const LEDGER_RESOURCE_SPECS: &[LedgerResourceSpec] = &[
    resource(
        CacheResourceKind::NostrEvent,
        CacheOwnerKind::Event,
        "events",
        true,
    ),
    resource(
        CacheResourceKind::NotificationRecord,
        CacheOwnerKind::Notification,
        "notifications",
        false,
    ),
    resource(
        CacheResourceKind::FeedCursor,
        CacheOwnerKind::FeedPage,
        "feedCursors",
        false,
    ),
    resource(
        CacheResourceKind::CoverageRow,
        CacheOwnerKind::FeedCoverage,
        "feedCoverage",
        false,
    ),
    resource(
        CacheResourceKind::ScanHint,
        CacheOwnerKind::FeedScanHint,
        "feedScanHints",
        false,
    ),
    resource(
        CacheResourceKind::TabState,
        CacheOwnerKind::TabSnapshot,
        "tabStates",
        false,
    ),
    resource(
        CacheResourceKind::RelaySummary,
        CacheOwnerKind::RelayDiagnostic,
        "relayDiagnosticSummaries",
        false,
    ),
    resource(
        CacheResourceKind::RelayInfo,
        CacheOwnerKind::RelayInformation,
        "relayInformation",
        false,
    ),
    resource(
        CacheResourceKind::RelayReadObservation,
        CacheOwnerKind::RelayReadObservation,
        "relay_read_observations",
        false,
    ),
    resource(
        CacheResourceKind::RelayReadScore,
        CacheOwnerKind::RelayReadScore,
        "relay_read_scores",
        false,
    ),
    resource(
        CacheResourceKind::RelayListSuggestion,
        CacheOwnerKind::RelaySuggestion,
        "relayListSuggestions",
        false,
    ),
    resource(
        CacheResourceKind::AuthorRelayRoute,
        CacheOwnerKind::RouteEvidence,
        "authorRelayRoutes",
        false,
    ),
    resource(
        CacheResourceKind::RouteEvidenceScore,
        CacheOwnerKind::RouteEvidenceScore,
        "route_evidence_scores",
        false,
    ),
    resource(
        CacheResourceKind::JobRecord,
        CacheOwnerKind::Job,
        "jobs",
        false,
    ),
];

#[must_use]
pub const fn ledger_resource_specs() -> &'static [LedgerResourceSpec] {
    LEDGER_RESOURCE_SPECS
}

#[must_use]
pub fn ledger_resource_kinds() -> Vec<CacheResourceKind> {
    LEDGER_RESOURCE_SPECS
        .iter()
        .map(|spec| spec.resource_kind)
        .collect()
}

#[must_use]
pub fn ledger_resource_spec(kind: CacheResourceKind) -> Option<&'static LedgerResourceSpec> {
    LEDGER_RESOURCE_SPECS
        .iter()
        .find(|spec| spec.resource_kind == kind)
}

#[must_use]
pub fn direct_ledger_resource_specs() -> Vec<&'static LedgerResourceSpec> {
    LEDGER_RESOURCE_SPECS
        .iter()
        .filter(|spec| !spec.event_owned)
        .collect()
}
