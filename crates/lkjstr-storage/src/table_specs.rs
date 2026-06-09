#![doc = "Storage table manifest rows."]

use crate::data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group};
use crate::manifest::StorageTableSpec;
use crate::resource::CacheResourceKind as ResourceKind;

macro_rules! t {
    ($name:literal, $schema:literal, $class:ident, $group:ident, $owner:literal, $commands:literal, $retention:literal, $stats:literal, $protected:literal) => {
        StorageTableSpec {
            name: $name,
            schema: $schema,
            data_class: DataClass::$class,
            inventory_group: Group::$group,
            primary_owner: $owner,
            command_family: $commands,
            retention_behavior: $retention,
            stats_projection: $stats,
            ledger_resource_kind: None,
            protected_by_default: $protected,
            repairable: false,
            compactable: false,
        }
    };
}

macro_rules! lt {
    ($name:literal, $schema:literal, $class:ident, $group:ident, $owner:literal, $commands:literal, $retention:literal, $stats:literal, $resource:ident, $protected:literal) => {
        StorageTableSpec {
            name: $name,
            schema: $schema,
            data_class: DataClass::$class,
            inventory_group: Group::$group,
            primary_owner: $owner,
            command_family: $commands,
            retention_behavior: $retention,
            stats_projection: $stats,
            ledger_resource_kind: Some(ResourceKind::$resource),
            protected_by_default: $protected,
            repairable: true,
            compactable: true,
        }
    };
}

#[rustfmt::skip]
pub(crate) const STORAGE_TABLE_SPECS: &[StorageTableSpec] = &[
    t!("workspaces", "&id, updatedAt, activeAccountId", ProtectedUserData, Protected, "workspace", "workspace", "protected", "row-count", true),
    t!("accounts", "&id, pubkey, signerType, updatedAt, lastUsedAt", ProtectedUserData, Protected, "accounts", "accounts", "protected", "row-count", true),
    t!("localAccountSecrets", "&accountId, pubkey, updatedAt", ProtectedUserData, Protected, "signer", "accounts", "protected", "row-count-redacted", true),
    lt!("notifications", "&id, accountPubkey, sourceEventId, actorPubkey, kind, createdAt, [accountPubkey+createdAt]", RecoverableCache, PrunableCache, "notifications", "notifications", "ledger-prunable", "row-count", NotificationRecord, false),
    t!("tweetDrafts", "&id, accountId, updatedAt", ProtectedUserData, Protected, "tweet", "tweet-drafts", "protected", "row-count", true),
    lt!("events", "&id, pubkey, kind, created_at, [kind+created_at], [pubkey+kind+created_at]", RecoverableCache, PrunableCache, "events", "event-cache", "ledger-prunable", "row-count", NostrEvent, false),
    t!("cacheLedger", "&id, ownerKind, resourceKind, resourceId, score, createdAt, updatedAt, protected, accountPubkey, feedKey, relayUrl, [protected+score], [ownerKind+score], [resourceKind+score]", Ledger, Ledger, "storage", "retention-ledger", "not-prunable-index", "row-count", false),
    lt!("eventRelays", "&id, eventId, relayUrl, receivedAt", RecoverableCache, PrunableCache, "events", "event-cache", "parent-ledger-prunable", "row-count", NostrEvent, false),
    lt!("eventTags", "&id, eventId, tagName, tagValue, created_at, [tagName+tagValue], [tagName+tagValue+created_at]", RecoverableCache, PrunableCache, "events", "event-cache", "parent-ledger-prunable", "row-count", NostrEvent, false),
    lt!("feedCursors", "&id, feedKey, updatedAt", DerivedFeedCache, DerivedPageCache, "feeds", "feed-cache", "ledger-prunable", "row-count", FeedCursor, false),
    lt!("feedCoverage", "&id, feedKey, relayUrl, groupKey, status, updatedAt, [feedKey+status], [feedKey+relayUrl], [feedKey+groupKey], [feedKey+updatedAt]", DerivedFeedCache, DerivedPageCache, "feeds", "feed-cache", "ledger-prunable", "coverage-status", CoverageRow, false),
    lt!("feedScanHints", "&id, scanKey, relayUrl, groupKey, filterKey, direction, updatedAt, [scanKey+direction], [scanKey+relayUrl]", DerivedFeedCache, DerivedPageCache, "feeds", "feed-cache", "ledger-prunable", "row-count", ScanHint, false),
    lt!("jobs", "&id, rootId, parentId, kind, status, updatedAt, [rootId+updatedAt]", RecoverableCache, PrunableCache, "jobs", "jobs", "dynamic-protection", "row-count", JobRecord, false),
    t!("cacheMeta", "&id, updatedAt", Metadata, Metadata, "storage", "storage-diagnostics", "metadata", "pressure-health", false),
    lt!("tabStates", "&id, workspaceId, tabId, lastPaneId, updatedAt", ProtectedUserData, Protected, "workspace", "tab-states", "active-protected-stale-prunable", "row-count", TabState, true),
    t!("settings", "&key, namespace, updatedAt", ProtectedUserData, Protected, "settings", "settings", "protected", "row-count", true),
    t!("relaySets", "&id, updatedAt, seeded", ProtectedUserData, Protected, "relays", "relay-sets", "protected", "row-count", true),
    lt!("relayDiagnosticSummaries", "&relayUrl, updatedAt", DiagnosticsCache, Diagnostics, "relays", "relay-diagnostics", "ledger-prunable", "row-count", RelaySummary, false),
    lt!("relayInformation", "&relayUrl, fetchedAt, status", DiagnosticsCache, Diagnostics, "relays", "relay-diagnostics", "ledger-prunable", "row-count", RelayInfo, false),
    lt!("relayListSuggestions", "&id, accountPubkey, relayUrl, updatedAt, [accountPubkey+relayUrl]", DiagnosticsCache, Diagnostics, "relays", "relay-diagnostics", "ledger-prunable", "row-count", RelayListSuggestion, false),
    lt!("authorRelayRoutes", "&id, authorPubkey, relayUrl, source, updatedAt, [authorPubkey+relayUrl]", DiagnosticsCache, Diagnostics, "relays", "relay-routes", "ledger-prunable", "row-count", AuthorRelayRoute, false),
    t!("relayRouteBlocks", "&relayUrl, reason, updatedAt", ProtectedSafetyConfiguration, ProtectedSafety, "relays", "relay-routes", "protected-safety", "row-count", true),
];
