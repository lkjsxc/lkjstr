use lkjstr_domain::{SignerType, create_account, create_local_account_record};
use lkjstr_storage::{
    account_record_id, account_record_json_bytes, local_secret_record_json_bytes,
    local_secret_record_key,
};

#[test]
fn account_rows_match_manifest_keys() -> Result<(), String> {
    let pubkey = "aa".repeat(32);
    let account = create_account(&pubkey, SignerType::Readonly, 10).ok_or("account")?;
    assert_eq!(account_record_id(&account), account.id);
    assert!(account_record_json_bytes(&account).map_err(|error| error.to_string())? > 0);
    let json = serde_json::to_value(account).map_err(|error| error.to_string())?;
    assert_eq!(json["signerType"], "readonly");
    assert_eq!(json["updatedAt"], 10);
    Ok(())
}

#[test]
fn local_secret_rows_match_manifest_keys_without_debug_secret() -> Result<(), String> {
    let (_account, secret_row) =
        create_local_account_record(None, 10).map_err(|error| format!("{error:?}"))?;
    assert_eq!(local_secret_record_key(&secret_row), secret_row.account_id);
    assert!(local_secret_record_json_bytes(&secret_row).map_err(|error| error.to_string())? > 0);
    assert!(!format!("{secret_row:?}").contains(&secret_row.secret_key));
    let json = serde_json::to_value(secret_row).map_err(|error| error.to_string())?;
    assert!(json.get("accountId").is_some());
    assert!(json.get("secret_key").is_none());
    Ok(())
}
