use lkjstr_domain::{
    RelaySet, RelaySetError, add_relay, ensure_user_set, patch_relay, remove_relay,
    restore_default_relay_set, seed_relay_sets, sorted_relay_sets,
};
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::{
    RelaySetIdCommand, RelaySettingsCommand, RelaySettingsProvider, RelaySettingsResult,
};

use crate::{
    host_status::{browser_now_ms, problem_status},
    relay_selection::{selected_relay_set_id, set_selected_relay_set_id},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_relay_sets_all, sqlite_relay_sets_put_all},
};

const DEFAULT_USER_SET_ID: &str = "public-default";

#[derive(Clone)]
struct RelayHost {
    db_name: String,
    worker_url: String,
}

pub fn relay_settings_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> RelaySettingsProvider {
    let host = RelayHost {
        db_name,
        worker_url,
    };
    RelaySettingsProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &RelayHost, command: RelaySettingsCommand) {
    match command {
        RelaySettingsCommand::Load(complete) => complete.complete(load_result(host, "").await),
        RelaySettingsCommand::Add(command) => {
            let sets = apply_change(host, |sets, now| {
                add_relay(&sets, &command.set_id, &command.input, now)
            })
            .await;
            command.complete.complete(load_after(host, sets).await);
        }
        RelaySettingsCommand::Patch(command) => {
            let sets = apply_change(host, |sets, now| {
                patch_relay(&sets, &command.set_id, &command.url, command.patch, now)
            })
            .await;
            command.complete.complete(load_after(host, sets).await);
        }
        RelaySettingsCommand::Remove(command) => {
            let sets = apply_change(host, |sets, now| {
                remove_relay(&sets, &command.set_id, &command.url, now)
            })
            .await;
            command.complete.complete(load_after(host, sets).await);
        }
        RelaySettingsCommand::Restore(command) => {
            let now = browser_now_ms();
            let loaded = load_sets(host, now).await;
            let sets = loaded.map(|sets| restore_default_relay_set(&sets, command.purpose, now));
            command.complete.complete(load_after(host, sets).await);
        }
        RelaySettingsCommand::MakeDefault(command) => make_default(host, command).await,
    }
}

async fn make_default(host: &RelayHost, command: RelaySetIdCommand) {
    let loaded = load_sets(host, browser_now_ms()).await;
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
    command.complete.complete(load_result(host, &status).await);
}

async fn apply_change(
    host: &RelayHost,
    change: impl FnOnce(Vec<RelaySet>, u64) -> Result<Vec<RelaySet>, RelaySetError>,
) -> StorageOutcome<Vec<RelaySet>> {
    let now = browser_now_ms();
    let sets = match load_sets(host, now).await {
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

async fn load_after(host: &RelayHost, sets: StorageOutcome<Vec<RelaySet>>) -> RelaySettingsResult {
    match sets {
        StorageOutcome::Ok(rows) => {
            let status = match save_sets(host, &rows).await {
                StorageOutcome::Ok(()) => "Relay settings saved.".to_owned(),
                outcome => problem_status("Relay settings save failed", outcome),
            };
            load_result(host, &status).await
        }
        outcome => {
            load_result(
                host,
                &problem_status("Relay settings change failed", outcome),
            )
            .await
        }
    }
}

async fn load_result(host: &RelayHost, status: &str) -> RelaySettingsResult {
    match load_sets(host, browser_now_ms()).await {
        StorageOutcome::Ok(sets) => {
            RelaySettingsResult::new(sets.clone(), resolve_selected_id(&sets), status.to_owned())
        }
        outcome => RelaySettingsResult::new(
            Vec::new(),
            DEFAULT_USER_SET_ID.to_owned(),
            problem_status("Relay settings unavailable", outcome),
        ),
    }
}

async fn load_sets(host: &RelayHost, now: u64) -> StorageOutcome<Vec<RelaySet>> {
    match read_sets(host).await {
        StorageOutcome::Ok(rows) if rows.is_empty() => {
            let seeded = seed_relay_sets(&[], now);
            match save_sets(host, &seeded).await {
                StorageOutcome::Ok(()) => StorageOutcome::Ok(sorted_relay_sets(seeded)),
                outcome => outcome.map(|_| Vec::new()),
            }
        }
        StorageOutcome::Ok(rows) => StorageOutcome::Ok(seed_relay_sets(&rows, now)),
        outcome => outcome,
    }
}

async fn read_sets(host: &RelayHost) -> StorageOutcome<Vec<RelaySet>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_relay_sets_all(&store).await
    })
    .await
}

async fn save_sets(host: &RelayHost, rows: &[RelaySet]) -> StorageOutcome<()> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_relay_sets_put_all(&store, rows).await
    })
    .await
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

const fn relay_error_reason(error: RelaySetError) -> &'static str {
    match error {
        RelaySetError::InvalidUrl => "invalid-url",
        RelaySetError::SetNotFound => "set-not-found",
        RelaySetError::NotUserSet => "not-user-set",
    }
}
