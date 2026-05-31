use serde::Deserialize;
use serde_json::Value;

use lkjstr_storage::{
    SettingRecord, StorageOutcome, default_setting_records, merge_setting_overrides,
    setting_override_for_value,
};
use lkjstr_ui::{
    SettingsCommand, SettingsImportCommand, SettingsKeyCommand, SettingsProvider, SettingsResult,
    SettingsValueCommand,
};

use crate::indexed_db::settings_store;

#[derive(Deserialize)]
struct ImportRow {
    key: String,
    value: Value,
}

pub fn settings_provider(db_name: String) -> SettingsProvider {
    SettingsProvider::new(move |command| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&db_name, command).await;
        });
    })
}

async fn run_command(db_name: &str, command: SettingsCommand) {
    match command {
        SettingsCommand::Load(complete) => complete.complete(load_result(db_name, "").await),
        SettingsCommand::Save(command) => save_setting(db_name, command).await,
        SettingsCommand::Reset(command) => reset_setting(db_name, command).await,
        SettingsCommand::Import(command) => import_settings(db_name, command).await,
    }
}

async fn save_setting(db_name: &str, command: SettingsValueCommand) {
    let now = browser_now_ms();
    let Some(row) = setting_override_for_value(&command.key, command.value, now) else {
        command
            .complete
            .complete(load_result(db_name, "Invalid setting value").await);
        return;
    };
    let status = match settings_store::setting_put(db_name, &row).await {
        StorageOutcome::Ok(()) => format!("Saved {}", row.key),
        outcome => problem_status("Save failed", outcome),
    };
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn reset_setting(db_name: &str, command: SettingsKeyCommand) {
    let status = match settings_store::setting_delete(db_name, &command.key).await {
        StorageOutcome::Ok(()) => format!("Reset {}", command.key),
        outcome => problem_status("Reset failed", outcome),
    };
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn import_settings(db_name: &str, command: SettingsImportCommand) {
    let rows = match serde_json::from_str::<Vec<ImportRow>>(&command.raw) {
        Ok(rows) => rows,
        Err(_) => {
            command
                .complete
                .complete(load_result(db_name, "Settings import failed").await);
            return;
        }
    };
    clear_current_overrides(db_name).await;
    let now = browser_now_ms();
    let mut saved = 0_usize;
    for row in rows {
        if let Some(override_row) = setting_override_for_value(&row.key, row.value, now)
            && settings_store::setting_put(db_name, &override_row)
                .await
                .is_ok()
        {
            saved += 1;
        }
    }
    command
        .complete
        .complete(load_result(db_name, &format!("Imported {saved} settings")).await);
}

async fn clear_current_overrides(db_name: &str) {
    if let StorageOutcome::Ok(rows) = settings_store::settings_all(db_name).await {
        for row in rows {
            let _outcome = settings_store::setting_delete(db_name, &row.key).await;
        }
    }
}

async fn load_result(db_name: &str, status: &str) -> SettingsResult {
    match settings_store::settings_all(db_name).await {
        StorageOutcome::Ok(overrides) => SettingsResult::new(
            merge_setting_overrides(&overrides, browser_now_ms()),
            status.to_owned(),
        ),
        outcome => SettingsResult::new(defaults(), problem_status("Settings unavailable", outcome)),
    }
}

fn defaults() -> Vec<SettingRecord> {
    default_setting_records(browser_now_ms())
}

fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

fn browser_now_ms() -> u64 {
    let now = js_sys::Date::now();
    if now.is_sign_negative() {
        0
    } else {
        now as u64
    }
}
