use serde_json::json;

use lkjstr_storage::{
    SettingOverrideRecord, default_setting_records, merge_setting_overrides,
    setting_override_for_value,
};

#[test]
fn settings_schema_contains_current_flat_keys() {
    let settings = default_setting_records(7);

    assert!(
        settings
            .iter()
            .any(|row| row.key == "appearance.cornerRadius")
    );
    assert!(settings.iter().any(|row| row.key == "cache.maxBytes"));
    assert!(
        settings
            .iter()
            .any(|row| row.key == "tweet.mediaUploadProvider")
    );
    assert!(
        settings
            .iter()
            .any(|row| row.key == "publish.clientTag.enabled" && row.value == json!(false))
    );
    assert!(
        settings
            .iter()
            .any(|row| row.key == "timeline.showClientTags" && row.value == json!(false))
    );
    assert!(!settings.iter().any(|row| row.key == "cache.maxEvents"));
}

#[test]
fn settings_merge_valid_overrides_and_ignore_invalid_values() {
    let overrides = vec![
        override_row("appearance.cornerRadius", "appearance", json!(6), 11),
        override_row("cache.maxBytes", "cache", json!(12), 12),
    ];
    let rows = merge_setting_overrides(&overrides, 1);

    assert!(
        rows.iter().any(|row| row.key == "appearance.cornerRadius"
            && row.value == json!(6.0)
            && row.changed)
    );
    assert!(
        rows.iter()
            .any(|row| row.key == "cache.maxBytes" && row.value == json!(67108864) && !row.changed)
    );
}

#[test]
fn settings_create_valid_override_rows() {
    let row = setting_override_for_value(
        "tweet.mediaUploadCustomServer",
        json!("https://upload.example"),
        19,
    );
    let invalid = setting_override_for_value(
        "tweet.mediaUploadCustomServer",
        json!("http://upload.example"),
        19,
    );

    assert!(row.is_some_and(|item| item.namespace == "tweet" && item.updated_at == 19));
    assert!(invalid.is_none());
}

fn override_row(
    key: &str,
    namespace: &str,
    value: serde_json::Value,
    updated_at: u64,
) -> SettingOverrideRecord {
    SettingOverrideRecord {
        key: key.to_owned(),
        namespace: namespace.to_owned(),
        value,
        updated_at,
    }
}
