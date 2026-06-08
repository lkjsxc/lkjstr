use lkjstr_domain::{SignerType, create_account, create_local_account_record};
use lkjstr_storage::{
    ACTIVE_ACCOUNT_SELECTOR_KEY, ActiveAccountSelectorRecord,
    active_account_selector_from_sqlite_row, active_account_selector_json_bytes,
    sqlite_active_account_selector_row,
};

#[test]
fn active_account_selector_records_empty_state() -> Result<(), serde_json::Error> {
    let selector = ActiveAccountSelectorRecord::empty(42);
    let sqlite = sqlite_active_account_selector_row(&selector)?;

    assert_eq!(sqlite.key, ACTIVE_ACCOUNT_SELECTOR_KEY);
    assert_eq!(selector.read_only_state, "none");
    assert_eq!(selector.local_signer_state, "none");
    assert_eq!(selector.nip07_availability, "unknown");
    assert_eq!(active_account_selector_from_sqlite_row(&sqlite)?, selector);
    Ok(())
}

#[test]
fn active_account_selector_records_readonly_and_local_states() -> Result<(), String> {
    let readonly =
        create_account(&"1".repeat(64), SignerType::Readonly, 7).ok_or("readonly account")?;
    let selector = ActiveAccountSelectorRecord::for_account(&readonly, false, "unavailable", 9);

    assert_eq!(
        selector.selected_account_id.as_deref(),
        Some(readonly.id.as_str())
    );
    assert_eq!(selector.signer_kind.as_deref(), Some("readonly"));
    assert_eq!(selector.read_only_state, "read-only");
    assert_eq!(selector.local_signer_state, "not-local");

    let (local, secret) =
        create_local_account_record(None, 10).map_err(|error| format!("{error:?}"))?;
    let local_selector = ActiveAccountSelectorRecord::for_account(&local, true, "unknown", 11);
    assert_eq!(local_selector.signer_kind.as_deref(), Some("local"));
    assert_eq!(local_selector.read_only_state, "signing");
    assert_eq!(local_selector.local_signer_state, "secret-present");
    assert!(!format!("{local_selector:?}").contains(&secret.secret_key));
    Ok(())
}

#[test]
fn active_account_selector_json_has_no_secret_fields() -> Result<(), Box<dyn std::error::Error>> {
    let account = create_account(&"2".repeat(64), SignerType::Nip07, 12)
        .ok_or_else(|| std::io::Error::other("account"))?;
    let selector = ActiveAccountSelectorRecord::for_account(&account, false, "available", 13);
    let value = serde_json::to_value(&selector)?;

    assert!(active_account_selector_json_bytes(&selector)? > 0);
    assert!(value.get("secret").is_none());
    assert!(value.get("secret_key").is_none());
    assert_eq!(value["nip07_availability"], "available");
    Ok(())
}
