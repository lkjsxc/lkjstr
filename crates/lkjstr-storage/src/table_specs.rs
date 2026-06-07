#![doc = "Storage table manifest rows."]

use crate::data_class::{StorageDataClass as DataClass, StorageInventoryGroup as Group};
use crate::manifest::{StorageTableSpec, ledger_table, table};
use crate::resource::CacheResourceKind as ResourceKind;

macro_rules! t {
    ($name:literal, $schema:literal, $class:ident, $group:ident, $owner:literal, $protected:literal) => {
        table(
            $name,
            $schema,
            DataClass::$class,
            Group::$group,
            $owner,
            $protected,
        )
    };
}

macro_rules! lt {
    ($name:literal, $schema:literal, $class:ident, $group:ident, $owner:literal, $resource:ident, $protected:literal) => {
        ledger_table(
            $name,
            $schema,
            DataClass::$class,
            Group::$group,
            $owner,
            ResourceKind::$resource,
            $protected,
        )
    };
}

#[rustfmt::skip]
pub(crate) const STORAGE_TABLE_SPECS: &[StorageTableSpec] = &[
    t!("workspaces", "&id, updatedAt, activeAccountId", ProtectedUserData, Protected, "workspace", true),
    t!("accounts", "&id, pubkey, signerType, updatedAt, lastUsedAt", ProtectedUserData, Protected, "accounts", true),
    t!("localAccountSecrets", "&accountId, pubkey, updatedAt", ProtectedUserData, Protected, "signer", true),
    lt!("notifications", "&id, accountPubkey, sourceEventId, actorPubkey, kind, createdAt, [accountPubkey+createdAt]", RecoverableCache, PrunableCache, "notifications", NotificationRecord, false),
    t!("tweetDrafts", "&id, accountId, updatedAt", ProtectedUserData, Protected, "tweet", true),
    lt!("events", "&id, pubkey, kind, created_at, [kind+created_at], [pubkey+kind+created_at]", RecoverableCache, PrunableCache, "events", NostrEvent, false),
    t!("cacheLedger", "&id, ownerKind, resourceKind, resourceId, score, createdAt, updatedAt, protected, accountPubkey, feedKey, relayUrl, [protected+score], [ownerKind+score], [resourceKind+score]", Ledger, Ledger, "storage", false),
    lt!("eventRelays", "&id, eventId, relayUrl, receivedAt", RecoverableCache, PrunableCache, "events", NostrEvent, false),
    lt!("eventTags", "&id, eventId, tagName, tagValue, created_at, [tagName+tagValue], [tagName+tagValue+created_at]", RecoverableCache, PrunableCache, "events", NostrEvent, false),
    lt!("feedCursors", "&id, feedKey, updatedAt", DerivedFeedCache, DerivedPageCache, "feeds", FeedCursor, false),
    lt!("feedCoverage", "&id, feedKey, relayUrl, groupKey, status, updatedAt, [feedKey+status], [feedKey+relayUrl], [feedKey+groupKey], [feedKey+updatedAt]", DerivedFeedCache, DerivedPageCache, "feeds", CoverageRow, false),
    lt!("feedScanHints", "&id, scanKey, relayUrl, groupKey, filterKey, direction, updatedAt, [scanKey+direction], [scanKey+relayUrl]", DerivedFeedCache, DerivedPageCache, "feeds", ScanHint, false),
    lt!("jobs", "&id, rootId, parentId, kind, status, updatedAt, [rootId+updatedAt]", RecoverableCache, PrunableCache, "jobs", JobRecord, false),
    t!("cacheMeta", "&id, updatedAt", Metadata, Metadata, "storage", false),
    lt!("tabStates", "&id, workspaceId, tabId, lastPaneId, updatedAt", ProtectedUserData, Protected, "workspace", TabState, true),
    t!("settings", "&key, namespace, updatedAt", ProtectedUserData, Protected, "settings", true),
    t!("relaySets", "&id, updatedAt, seeded", ProtectedUserData, Protected, "relays", true),
    lt!("relayDiagnosticSummaries", "&relayUrl, updatedAt", DiagnosticsCache, Diagnostics, "relays", RelaySummary, false),
    lt!("relayInformation", "&relayUrl, fetchedAt, status", DiagnosticsCache, Diagnostics, "relays", RelayInfo, false),
    lt!("relayListSuggestions", "&id, accountPubkey, relayUrl, updatedAt, [accountPubkey+relayUrl]", DiagnosticsCache, Diagnostics, "relays", RelayListSuggestion, false),
    lt!("authorRelayRoutes", "&id, authorPubkey, relayUrl, source, updatedAt, [authorPubkey+relayUrl]", DiagnosticsCache, Diagnostics, "relays", AuthorRelayRoute, false),
    t!("relayRouteBlocks", "&relayUrl, reason, updatedAt", ProtectedSafetyConfiguration, ProtectedSafety, "relays", true),
];
