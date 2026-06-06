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

use crate::{
    host_status::{browser_now_ms, problem_status},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_setting_put, sqlite_settings_all},
    upload_discovery::{resolve_blossom_upload_endpoint, resolve_upload_endpoint},
};

#[derive(Clone)]
struct UploadHost {
    db_name: String,
    worker_url: String,
}

pub fn upload_settings_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> UploadSettingsProvider {
    let host = UploadHost {
        db_name,
        worker_url,
    };
    UploadSettingsProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &UploadHost, command: UploadSettingsCommand) {
    match command {
        UploadSettingsCommand::Load(complete) => complete.complete(load_result(host, "").await),
        UploadSettingsCommand::SaveProvider(command) => save_provider(host, command).await,
        UploadSettingsCommand::SaveCustom(command) => save_custom(host, command).await,
        UploadSettingsCommand::SaveNoTransform(command) => save_no_transform(host, command).await,
        UploadSettingsCommand::Discover(command) => discover(command).await,
    }
}

async fn save_provider(host: &UploadHost, command: UploadProviderCommand) {
    let value = Value::String(upload_provider_key(command.provider).to_owned());
    let status = save_value(host, "tweet.mediaUploadProvider", value, "Provider saved").await;
    command.complete.complete(load_result(host, &status).await);
}

async fn save_custom(host: &UploadHost, command: UploadTextCommand) {
    if !valid_custom_upload_server(&command.text) {
        command
            .complete
            .complete(load_result(host, "Custom upload server must be blank or HTTPS.").await);
        return;
    }
    let status = save_value(
        host,
        "tweet.mediaUploadCustomServer",
        Value::String(command.text),
        "Custom server saved.",
    )
    .await;
    command.complete.complete(load_result(host, &status).await);
}

async fn save_no_transform(host: &UploadHost, command: UploadBoolCommand) {
    let status = save_value(
        host,
        "tweet.mediaUploadNoTransform",
        Value::Bool(command.value),
        "No transform setting saved.",
    )
    .await;
    command.complete.complete(load_result(host, &status).await);
}

async fn discover(command: UploadDiscoverCommand) {
    let status = if command.server.trim().is_empty() {
        "Media upload is disabled.".to_owned()
    } else if !valid_custom_upload_server(&command.settings.custom_server) {
        "Custom upload server must be blank or HTTPS.".to_owned()
    } else {
        endpoint_status(&command)
            .await
            .unwrap_or_else(|error| error)
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

async fn save_value(host: &UploadHost, key: &str, value: Value, ok_status: &str) -> String {
    let Some(row) = setting_override_for_value(key, value, browser_now_ms()) else {
        return "Invalid upload setting value.".to_owned();
    };
    let outcome = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_setting_put(&store, &row).await
    })
    .await;
    match outcome {
        StorageOutcome::Ok(()) => {
            notify_settings_changed();
            ok_status.to_owned()
        }
        outcome => problem_status("Upload setting save failed", outcome),
    }
}

async fn load_result(host: &UploadHost, status: &str) -> UploadSettingsResult {
    match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_settings_all(&store).await
    })
    .await
    {
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

fn notify_settings_changed() {
    if let Some(window) = web_sys::window()
        && let Ok(event) = web_sys::Event::new("lkjstr-settings-changed")
    {
        let _result = window.dispatch_event(&event);
    }
}
