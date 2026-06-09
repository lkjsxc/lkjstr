use lkjstr_storage::StorageOutcome;
use lkjstr_ui::{HostProviders, WorkspacePersistence};

use crate::{
    accounts_host, app_log_host, browser_inventory, host_status::browser_now_ms,
    relay_settings_host, settings_host, sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_storage_stats_snapshot, storage_worker::DEFAULT_WORKER_URL, tweet_host,
    upload_settings_host, workspace_host,
};

const DEFAULT_DB_NAME: &str = "lkjstr";

pub fn mount_rust_workspace_shell() {
    mount_rust_workspace_shell_from_db(DEFAULT_DB_NAME.to_owned());
}

pub fn mount_rust_workspace_shell_from_db(db_name: String) {
    mount_rust_workspace_shell_from_db_with_worker(db_name, DEFAULT_WORKER_URL.to_owned());
}

pub fn mount_rust_workspace_shell_from_db_with_worker(db_name: String, worker_url: String) {
    wasm_bindgen_futures::spawn_local(async move {
        let startup =
            workspace_host::workspace_startup_input(&db_name, &worker_url, browser_now_ms()).await;
        lkjstr_ui::mount_app_with_host(startup, providers(db_name, worker_url));
    });
}

fn providers(db_name: String, worker_url: String) -> HostProviders {
    HostProviders {
        persistence: workspace_persistence(db_name.clone(), worker_url.clone()),
        accounts: accounts_host::accounts_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        relay_settings: relay_settings_host::relay_settings_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        stats: stats_provider(db_name.clone(), worker_url.clone()),
        log: app_log_host::log_provider_with_worker_url(db_name.clone(), worker_url.clone()),
        settings: settings_host::settings_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        upload_settings: upload_settings_host::upload_settings_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        tweet: tweet_host::tweet_provider_with_worker_url(db_name, worker_url),
    }
}

fn workspace_persistence(db_name: String, worker_url: String) -> WorkspacePersistence {
    WorkspacePersistence::new(move |workspace| {
        let db_name = db_name.clone();
        let worker_url = worker_url.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let _outcome = workspace_host::workspace_put(&db_name, &worker_url, &workspace).await;
        });
    })
}

fn stats_provider(db_name: String, worker_url: String) -> lkjstr_ui::StatsProvider {
    lkjstr_ui::StatsProvider::new(move |complete| {
        let db_name = db_name.clone();
        let worker_url = worker_url.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let snapshot = with_sqlite_store(&db_name, &worker_url, |store| async move {
                StorageOutcome::Ok(sqlite_storage_stats_snapshot(&store).await)
            })
            .await;
            complete.complete(match snapshot {
                StorageOutcome::Ok(snapshot) => {
                    let rows = browser_inventory::browser_inventory_rows().await;
                    snapshot.with_additional_rows(rows)
                }
                outcome => unavailable_snapshot(outcome),
            });
        });
    })
}

fn unavailable_snapshot<T>(outcome: StorageOutcome<T>) -> lkjstr_storage::StorageStatsSnapshot {
    let reason = outcome
        .problem()
        .map_or("unavailable", |problem| problem.reason);
    lkjstr_storage::StorageStatsSnapshot::manifest_unavailable(reason)
}
