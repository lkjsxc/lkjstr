use lkjstr_domain::{
    UploadProvider, UploadSettings, default_upload_settings, upload_provider_from_key,
    upload_provider_key, upload_settings, valid_custom_upload_server,
};
use lkjstr_storage::{
    SettingRecord, StorageOutcome, merge_setting_overrides, setting_override_for_value,
};
use lkjstr_ui::{
    UploadBoolCommand, UploadDiscoverCommand, UploadProviderCommand, UploadSettingsCommand,
    UploadSettingsProvider, UploadSettingsResult, UploadTextCommand,
};
use serde_json::Value;

use crate::indexed_db::settings_store;
use crate::upload_discovery::{resolve_blossom_upload_endpoint, resolve_upload_endpoint};

pub fn upload_settings_provider(db_name: String) -> UploadSettingsProvider {
    UploadSettingsProvider::new(move |command| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&db_name, command).await;
        });
    })
}

async fn run_command(db_name: &str, command: UploadSettingsCommand) {
    match command {
        UploadSettingsCommand::Load(complete) => {
            complete.complete(load_result(db_name, "").await);
        }
        UploadSettingsCommand::SaveProvider(command) => save_provider(db_name, command).await,
        UploadSettingsCommand::SaveCustom(command) => save_custom(db_name, command).await,
        UploadSettingsCommand::SaveNoTransform(command) => {
            save_no_transform(db_name, command).await
        }
        UploadSettingsCommand::Discover(command) => discover(command).await,
    }
}

async fn save_provider(db_name: &str, command: UploadProviderCommand) {
    let value = Value::String(upload_provider_key(command.provider).to_owned());
    let status = save_value(
        db_name,
        "tweet.mediaUploadProvider",
        value,
        "Provider saved",
    )
    .await;
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn save_custom(db_name: &str, command: UploadTextCommand) {
    if !valid_custom_upload_server(&command.text) {
        command
            .complete
            .complete(load_result(db_name, "Custom upload server must be blank or HTTPS.").await);
        return;
    }
    let status = save_value(
        db_name,
        "tweet.mediaUploadCustomServer",
        Value::String(command.text),
        "Custom server saved.",
    )
    .await;
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn save_no_transform(db_name: &str, command: UploadBoolCommand) {
    let status = save_value(
        db_name,
        "tweet.mediaUploadNoTransform",
        Value::Bool(command.value),
        "No transform setting saved.",
    )
    .await;
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn discover(command: UploadDiscoverCommand) {
    let status = if command.server.trim().is_empty() {
        "Media upload is disabled.".to_owned()
    } else if !valid_custom_upload_server(&command.settings.custom_server) {
        "Custom upload server must be blank or HTTPS.".to_owned()
    } else {
        match endpoint_status(&command).await {
            Ok(status) => status,
            Err(error) => error,
        }
    };
    command
        .complete
        .complete(UploadSettingsResult::new(command.settings, status));
}

async fn endpoint_status(command: &UploadDiscoverCommand) -> Result<String, String> {
    if command.settings.provider == UploadProvider::Blossom {
        return resolve_blossom_upload_endpoint(&command.server)
            .map(|endpoint| format!("Blossom endpoint OK: {endpoint}"));
    }
    resolve_upload_endpoint(&command.server)
        .await
        .map(|endpoint| format!("Discovery OK: {endpoint}"))
}

async fn save_value(db_name: &str, key: &str, value: Value, ok_status: &str) -> String {
    let now = browser_now_ms();
    let Some(row) = setting_override_for_value(key, value, now) else {
        return "Invalid upload setting value.".to_owned();
    };
    match settings_store::setting_put(db_name, &row).await {
        StorageOutcome::Ok(()) => {
            notify_settings_changed();
            ok_status.to_owned()
        }
        outcome => problem_status("Upload setting save failed", outcome),
    }
}

async fn load_result(db_name: &str, status: &str) -> UploadSettingsResult {
    match settings_store::settings_all(db_name).await {
        StorageOutcome::Ok(overrides) => {
            let records = merge_setting_overrides(&overrides, browser_now_ms());
            UploadSettingsResult::new(settings_from_records(&records), status.to_owned())
        }
        outcome => UploadSettingsResult::new(
            default_upload_settings(),
            problem_status("Upload settings unavailable", outcome),
        ),
    }
}

fn settings_from_records(records: &[SettingRecord]) -> UploadSettings {
    let provider = value_text(records, "tweet.mediaUploadProvider")
        .and_then(upload_provider_from_key)
        .unwrap_or(UploadProvider::Blossom);
    let custom_server = value_text(records, "tweet.mediaUploadCustomServer")
        .unwrap_or_default()
        .to_owned();
    let no_transform = value_bool(records, "tweet.mediaUploadNoTransform").unwrap_or(true);
    upload_settings(provider, custom_server, no_transform)
}

fn value_text<'a>(records: &'a [SettingRecord], key: &str) -> Option<&'a str> {
    records
        .iter()
        .find(|row| row.key == key)
        .and_then(|row| row.value.as_str())
}

fn value_bool(records: &[SettingRecord], key: &str) -> Option<bool> {
    records
        .iter()
        .find(|row| row.key == key)
        .and_then(|row| row.value.as_bool())
}

fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

fn notify_settings_changed() {
    if let Some(window) = web_sys::window()
        && let Ok(event) = web_sys::Event::new("lkjstr-settings-changed")
    {
        let _result = window.dispatch_event(&event);
    }
}

fn browser_now_ms() -> u64 {
    js_sys::Date::now().max(0.0) as u64
}
