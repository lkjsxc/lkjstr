use lkjstr_domain::{RelayPurpose, seed_relay_sets};
use lkjstr_storage::{relay_set_record_id, relay_set_record_json_bytes};

#[test]
fn relay_set_rows_match_manifest_keys() -> Result<(), String> {
    let rows = seed_relay_sets(&[], 10);
    let public = rows
        .iter()
        .find(|row| row.purpose == RelayPurpose::User)
        .ok_or("public relay set")?;
    assert_eq!(relay_set_record_id(public), "public-default");
    let value = serde_json::to_value(public).map_err(|error| error.to_string())?;
    assert_eq!(value["updatedAt"], 10);
    assert_eq!(value["purpose"], "user");
    assert!(relay_set_record_json_bytes(public).map_err(|error| error.to_string())? > 100);
    Ok(())
}
