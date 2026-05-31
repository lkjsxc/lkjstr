use lkjstr_storage::{SettingOverrideRecord, setting_record_json_bytes, setting_record_key};
use serde_json::json;

#[test]
fn setting_records_roundtrip_storage_json() {
    let row = SettingOverrideRecord {
        key: "cache.maxBytes".to_owned(),
        namespace: "cache".to_owned(),
        value: json!(4096),
        updated_at: 7,
    };
    let json = serde_json::to_string(&row).unwrap_or_default();
    assert!(json.contains("updatedAt"));
    let parsed = serde_json::from_str::<SettingOverrideRecord>(&json);
    assert_eq!(parsed.ok(), Some(row.clone()));
    assert!(setting_record_json_bytes(&row).is_ok());
}

#[test]
fn setting_record_keys_use_setting_key() {
    let row = SettingOverrideRecord {
        key: "tweet.mediaUploadNoTransform".to_owned(),
        namespace: "tweet".to_owned(),
        value: json!(true),
        updated_at: 9,
    };
    assert_eq!(setting_record_key(&row), "tweet.mediaUploadNoTransform");
}
