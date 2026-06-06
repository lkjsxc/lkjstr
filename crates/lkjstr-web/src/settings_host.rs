use serde::Deserialize;
use serde_json::Value;

use lkjstr_storage::{
    SettingOverrideRecord, SettingRecord, StorageOutcome, default_setting_records,
    merge_setting_overrides, setting_override_for_value,
};
use lkjstr_ui::{
    SettingsCommand, SettingsImportCommand, SettingsKeyCommand, SettingsProvider, SettingsResult,
    SettingsValueCommand,
};

use crate::{
    host_status::{browser_now_ms, problem_status},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        sqlite_setting_delete, sqlite_setting_put, sqlite_settings_all, sqlite_settings_replace_all,
    },
};

#[derive(Clone)]
struct SettingsHost {
    db_name: String,
    worker_url: String,
}

#[derive(Deserialize)]
struct ImportRow {
    key: String,
    value: Value,
}

pub fn settings_provider_with_worker_url(db_name: String, worker_url: String) -> SettingsProvider {
    let host = SettingsHost {
        db_name,
        worker_url,
    };
    SettingsProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &SettingsHost, command: SettingsCommand) {
    match command {
        SettingsCommand::Load(complete) => complete.complete(load_result(host, "").await),
        SettingsCommand::Save(command) => save_setting(host, command).await,
        SettingsCommand::Reset(command) => reset_setting(host, command).await,
        SettingsCommand::Import(command) => import_settings(host, command).await,
    }
}

async fn save_setting(host: &SettingsHost, command: SettingsValueCommand) {
    let now = browser_now_ms();
    let Some(row) = setting_override_for_value(&command.key, command.value, now) else {
        command
            .complete
            .complete(load_result(host, "Invalid setting value").await);
        return;
    };
    let key = row.key.clone();
    let status = match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_setting_put(&store, &row).await
    })
    .await
    {
        StorageOutcome::Ok(()) => format!("Saved {key}"),
        outcome => problem_status("Save failed", outcome),
    };
    command.complete.complete(load_result(host, &status).await);
}

async fn reset_setting(host: &SettingsHost, command: SettingsKeyCommand) {
    let key = command.key.clone();
    let status = match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_setting_delete(&store, &key).await
    })
    .await
    {
        StorageOutcome::Ok(()) => format!("Reset {}", command.key),
        outcome => problem_status("Reset failed", outcome),
    };
    command.complete.complete(load_result(host, &status).await);
}

async fn import_settings(host: &SettingsHost, command: SettingsImportCommand) {
    let rows = match import_rows(&command.raw, browser_now_ms()) {
        Some(rows) => rows,
        None => {
            command
                .complete
                .complete(load_result(host, "Settings import failed").await);
            return;
        }
    };
    let imported = rows.len();
    let status = match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_settings_replace_all(&store, &rows).await
    })
    .await
    {
        StorageOutcome::Ok(()) => format!("Imported {imported} settings"),
        outcome => problem_status("Settings import failed", outcome),
    };
    command.complete.complete(load_result(host, &status).await);
}

fn import_rows(raw: &str, now: u64) -> Option<Vec<SettingOverrideRecord>> {
    let rows = serde_json::from_str::<Vec<ImportRow>>(raw).ok()?;
    Some(
        rows.into_iter()
            .filter_map(|row| setting_override_for_value(&row.key, row.value, now))
            .collect(),
    )
}

async fn load_result(host: &SettingsHost, status: &str) -> SettingsResult {
    match load_overrides(host).await {
        StorageOutcome::Ok(overrides) => SettingsResult::new(
            merge_setting_overrides(&overrides, browser_now_ms()),
            status.to_owned(),
        ),
        outcome => SettingsResult::new(defaults(), problem_status("Settings unavailable", outcome)),
    }
}

async fn load_overrides(host: &SettingsHost) -> StorageOutcome<Vec<SettingOverrideRecord>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_settings_all(&store).await
    })
    .await
}

fn defaults() -> Vec<SettingRecord> {
    default_setting_records(browser_now_ms())
}
