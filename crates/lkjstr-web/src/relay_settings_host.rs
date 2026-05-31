use lkjstr_domain::{
    RelaySet, RelaySetError, add_relay, ensure_user_set, patch_relay, remove_relay,
    restore_default_relay_set, seed_relay_sets, sorted_relay_sets,
};
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::{
    RelaySetIdCommand, RelaySettingsCommand, RelaySettingsProvider, RelaySettingsResult,
};

use crate::indexed_db::relay_set_store;

const SELECTED_RELAY_SET_KEY: &str = "lkjstr.defaultRelaySetId";
const DEFAULT_USER_SET_ID: &str = "public-default";

pub fn relay_settings_provider(db_name: String) -> RelaySettingsProvider {
    RelaySettingsProvider::new(move |command| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&db_name, command).await;
        });
    })
}

async fn run_command(db_name: &str, command: RelaySettingsCommand) {
    match command {
        RelaySettingsCommand::Load(complete) => complete.complete(load_result(db_name, "").await),
        RelaySettingsCommand::Add(command) => {
            let sets = apply_change(db_name, |sets, now| {
                add_relay(&sets, &command.set_id, &command.input, now)
            })
            .await;
            command.complete.complete(load_after(db_name, sets).await);
        }
        RelaySettingsCommand::Patch(command) => {
            let sets = apply_change(db_name, |sets, now| {
                patch_relay(&sets, &command.set_id, &command.url, command.patch, now)
            })
            .await;
            command.complete.complete(load_after(db_name, sets).await);
        }
        RelaySettingsCommand::Remove(command) => {
            let sets = apply_change(db_name, |sets, now| {
                remove_relay(&sets, &command.set_id, &command.url, now)
            })
            .await;
            command.complete.complete(load_after(db_name, sets).await);
        }
        RelaySettingsCommand::Restore(command) => {
            let now = browser_now_ms();
            let loaded = load_sets(db_name, now).await;
            let sets = loaded.map(|sets| restore_default_relay_set(&sets, command.purpose, now));
            command.complete.complete(load_after(db_name, sets).await);
        }
        RelaySettingsCommand::MakeDefault(command) => make_default(db_name, command).await,
    }
}

async fn make_default(db_name: &str, command: RelaySetIdCommand) {
    let loaded = load_sets(db_name, browser_now_ms()).await;
    let status = match loaded {
        StorageOutcome::Ok(sets) => match ensure_user_set(&sets, &command.set_id) {
            Ok(()) => {
                set_selected_relay_set_id(&command.set_id);
                "Default relay set updated.".to_owned()
            }
            Err(error) => format!(
                "Relay settings change failed: {}",
                relay_error_reason(error)
            ),
        },
        outcome => problem_status("Relay sets unavailable", outcome),
    };
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn apply_change(
    db_name: &str,
    change: impl FnOnce(Vec<RelaySet>, u64) -> Result<Vec<RelaySet>, RelaySetError>,
) -> StorageOutcome<Vec<RelaySet>> {
    let now = browser_now_ms();
    let sets = match load_sets(db_name, now).await {
        StorageOutcome::Ok(sets) => sets,
        outcome => return outcome,
    };
    match change(sets, now) {
        Ok(next) => StorageOutcome::Ok(next),
        Err(error) => StorageOutcome::Corrupt(lkjstr_storage::StorageProblem::new(
            lkjstr_storage::StorageOperation::Write,
            "relaySets",
            relay_error_reason(error),
            "relay-settings-change",
        )),
    }
}

async fn load_after(db_name: &str, sets: StorageOutcome<Vec<RelaySet>>) -> RelaySettingsResult {
    match sets {
        StorageOutcome::Ok(rows) => {
            let status = match relay_set_store::relay_sets_put_all(db_name, &rows).await {
                StorageOutcome::Ok(()) => "Relay settings saved.".to_owned(),
                outcome => problem_status("Relay settings save failed", outcome),
            };
            load_result(db_name, &status).await
        }
        outcome => {
            load_result(
                db_name,
                &problem_status("Relay settings change failed", outcome),
            )
            .await
        }
    }
}

async fn load_result(db_name: &str, status: &str) -> RelaySettingsResult {
    match load_sets(db_name, browser_now_ms()).await {
        StorageOutcome::Ok(sets) => {
            let selected = resolve_selected_id(&sets);
            RelaySettingsResult::new(sets, selected, status.to_owned())
        }
        outcome => RelaySettingsResult::new(
            Vec::new(),
            DEFAULT_USER_SET_ID.to_owned(),
            problem_status("Relay settings unavailable", outcome),
        ),
    }
}

async fn load_sets(db_name: &str, now: u64) -> StorageOutcome<Vec<RelaySet>> {
    match relay_set_store::relay_sets_all(db_name).await {
        StorageOutcome::Ok(rows) if rows.is_empty() => {
            let seeded = seed_relay_sets(&[], now);
            match relay_set_store::relay_sets_put_all(db_name, &seeded).await {
                StorageOutcome::Ok(()) => StorageOutcome::Ok(sorted_relay_sets(seeded)),
                outcome => outcome.map(|_| Vec::new()),
            }
        }
        StorageOutcome::Ok(rows) => StorageOutcome::Ok(seed_relay_sets(&rows, now)),
        outcome => outcome,
    }
}

fn resolve_selected_id(sets: &[RelaySet]) -> String {
    let stored = selected_relay_set_id();
    if let Some(id) = stored
        && sets
            .iter()
            .any(|set| set.id == id && set.purpose == lkjstr_domain::RelayPurpose::User)
    {
        return id;
    }
    let fallback = sets
        .iter()
        .find(|set| set.purpose == lkjstr_domain::RelayPurpose::User)
        .map(|set| set.id.clone())
        .unwrap_or_else(|| DEFAULT_USER_SET_ID.to_owned());
    set_selected_relay_set_id(&fallback);
    fallback
}

fn selected_relay_set_id() -> Option<String> {
    local_storage()?
        .get_item(SELECTED_RELAY_SET_KEY)
        .ok()
        .flatten()
}

fn set_selected_relay_set_id(id: &str) {
    if let Some(storage) = local_storage() {
        let _result = storage.set_item(SELECTED_RELAY_SET_KEY, id);
    }
}

fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}

fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

const fn relay_error_reason(error: RelaySetError) -> &'static str {
    match error {
        RelaySetError::InvalidUrl => "invalid-url",
        RelaySetError::SetNotFound => "set-not-found",
        RelaySetError::NotUserSet => "not-user-set",
    }
}

fn browser_now_ms() -> u64 {
    js_sys::Date::now().max(0.0) as u64
}
