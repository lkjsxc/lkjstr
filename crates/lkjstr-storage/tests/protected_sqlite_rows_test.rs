use lkjstr_domain::{
    SignerType, TabSnapshotPayload, ToolTabSnapshot, create_account, default_user_relay_set,
    empty_tweet_draft,
};
use lkjstr_storage::{
    LocalAccountSecretRecord, SettingOverrideRecord, TabStateRecord, account_from_sqlite_row,
    account_sqlite_key, local_secret_from_sqlite_row, local_secret_sqlite_key,
    relay_set_from_sqlite_row, setting_from_sqlite_row, sqlite_account_row,
    sqlite_cache_ledger_row, sqlite_local_secret_row, sqlite_relay_set_row, sqlite_setting_row,
    sqlite_tab_state_row, sqlite_tweet_draft_row, sqlite_workspace_row, tab_state_from_sqlite_row,
    tab_state_id, tab_state_ledger_record, tweet_draft_from_sqlite_row, workspace_from_sqlite_row,
};
use serde_json::json;

#[test]
fn sqlite_settings_rows_keep_flat_key_and_value_json() -> Result<(), serde_json::Error> {
    let row = SettingOverrideRecord {
        key: "tweet.mediaUploadNoTransform".to_owned(),
        namespace: "tweet".to_owned(),
        value: json!(false),
        updated_at: 42,
    };

    let sqlite = sqlite_setting_row(&row)?;
    assert_eq!(sqlite.key, row.key);
    assert_eq!(sqlite.value_json, "false");
    assert_eq!(setting_from_sqlite_row(&sqlite)?, row);
    Ok(())
}

#[test]
fn sqlite_workspace_rows_store_full_workspace_snapshot() -> Result<(), serde_json::Error> {
    let workspace = lkjstr_domain::bootstrap_workspace();
    let sqlite = sqlite_workspace_row(&workspace)?;

    assert_eq!(sqlite.workspace_id, "main");
    assert_eq!(sqlite.active_pane_id, workspace.focused_pane_id);
    assert_eq!(sqlite.active_tab_id, workspace.focused_tab_id);
    assert!(sqlite.layout_json.contains("\"tabGroups\""));
    assert_eq!(workspace_from_sqlite_row(&sqlite)?, workspace);
    Ok(())
}

#[test]
fn sqlite_tab_state_rows_pair_with_cache_ledger() -> Result<(), serde_json::Error> {
    let row = TabStateRecord {
        id: tab_state_id("main", "tab"),
        workspace_id: "main".to_owned(),
        tab_id: "tab".to_owned(),
        last_pane_id: Some("pane".to_owned()),
        state: TabSnapshotPayload::Tool(ToolTabSnapshot {
            scroll_top: Some(12),
            ..ToolTabSnapshot::default()
        }),
        updated_at: 3_600_000,
    };
    let sqlite = sqlite_tab_state_row(&row)?;
    let ledger = sqlite_cache_ledger_row(&tab_state_ledger_record(&row)?);

    assert_eq!(sqlite.workspace_id, "main");
    assert_eq!(sqlite.tab_kind, "tool");
    assert_eq!(tab_state_from_sqlite_row(&sqlite)?, row);
    assert_eq!(ledger.resource_id, row.id);
    assert_eq!(ledger.resource_kind, "tab-state");
    assert_eq!(ledger.table_name, "tab_states");
    assert_eq!(ledger.protected, 0);
    assert!(ledger.byte_count > 0);
    Ok(())
}

#[test]
fn sqlite_account_and_secret_rows_use_pubkey_key() -> Result<(), Box<dyn std::error::Error>> {
    let pubkey = "1".repeat(64);
    let account = create_account(&pubkey, SignerType::Readonly, 7)
        .ok_or_else(|| std::io::Error::other("account parse failed"))?;
    let secret = LocalAccountSecretRecord {
        account_id: account.id.clone(),
        pubkey: account.pubkey.clone(),
        secret_key: "2".repeat(64),
        created_at: 7,
        updated_at: 8,
    };

    let sqlite_account = sqlite_account_row(&account)?;
    let sqlite_secret = sqlite_local_secret_row(&secret)?;

    assert_eq!(account_sqlite_key(&account.id), account.pubkey);
    assert_eq!(local_secret_sqlite_key(&secret.account_id), account.pubkey);
    assert_eq!(sqlite_account.pubkey, account.pubkey);
    assert_eq!(sqlite_account.signer_kind, "readonly");
    assert_eq!(sqlite_secret.pubkey, account.pubkey);
    assert_eq!(account_from_sqlite_row(&sqlite_account)?, account);
    assert_eq!(local_secret_from_sqlite_row(&sqlite_secret)?, secret);
    Ok(())
}

#[test]
fn sqlite_relay_sets_and_tweet_drafts_keep_json_payloads() -> Result<(), serde_json::Error> {
    let relay_set = default_user_relay_set(9);
    let draft = empty_tweet_draft("tab:tweet", 11);

    let sqlite_relays = sqlite_relay_set_row(&relay_set)?;
    let sqlite_draft = sqlite_tweet_draft_row(&draft)?;

    assert_eq!(sqlite_relays.set_id, "public-default");
    assert_eq!(sqlite_relays.selected_read, 1);
    assert_eq!(sqlite_relays.selected_write, 1);
    assert!(sqlite_relays.relays_json.contains("relay.damus.io"));
    assert_eq!(relay_set_from_sqlite_row(&sqlite_relays)?, relay_set);
    assert_eq!(sqlite_draft.draft_id, "tab:tweet");
    assert_eq!(sqlite_draft.body, "");
    assert_eq!(sqlite_draft.attachments_json, "[]");
    assert_eq!(tweet_draft_from_sqlite_row(&sqlite_draft)?, draft);
    Ok(())
}
