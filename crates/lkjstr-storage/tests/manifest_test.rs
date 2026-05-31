use lkjstr_storage::{
    CacheResourceKind, StorageDataClass, StorageInventoryGroup, is_storage_table_name,
    storage_manifest_group, storage_table_names, storage_table_spec, storage_table_specs,
};

#[test]
fn manifest_names_match_current_storage_contract() {
    let names = storage_table_names();
    assert_eq!(
        names,
        vec![
            "workspaces",
            "accounts",
            "localAccountSecrets",
            "notifications",
            "tweetDrafts",
            "events",
            "cacheLedger",
            "eventRelays",
            "eventTags",
            "feedCursors",
            "feedCoverage",
            "feedScanHints",
            "jobs",
            "cacheMeta",
            "tabStates",
            "settings",
            "relaySets",
            "relayDiagnosticSummaries",
            "relayInformation",
            "relayListSuggestions",
            "authorRelayRoutes",
            "relayRouteBlocks",
        ]
    );
}

#[test]
fn manifest_retention_flags_follow_ledger_resources() {
    for spec in storage_table_specs() {
        assert_eq!(spec.compactable, spec.ledger_resource_kind.is_some());
        assert_eq!(spec.repairable, spec.ledger_resource_kind.is_some());
    }
}

#[test]
fn table_lookup_and_groups_are_coherent() {
    assert!(is_storage_table_name("events"));
    assert!(!is_storage_table_name("unknown"));
    assert_eq!(
        storage_manifest_group("settings"),
        Some(StorageInventoryGroup::Protected)
    );
    assert_eq!(storage_manifest_group("missing"), None);
}

#[test]
fn protected_and_ledger_tables_keep_specific_classification() {
    let settings = storage_table_spec("settings");
    assert!(matches!(
        settings,
        Some(spec) if spec.data_class == StorageDataClass::ProtectedUserData
            && spec.protected_by_default
    ));

    let tab_states = storage_table_spec("tabStates");
    assert!(matches!(
        tab_states,
        Some(spec) if spec.ledger_resource_kind == Some(CacheResourceKind::TabState)
            && spec.protected_by_default
    ));
}
