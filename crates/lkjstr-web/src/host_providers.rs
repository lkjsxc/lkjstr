use lkjstr_storage::StorageOutcome;
use lkjstr_ui::{HostProviders, WorkspacePersistence};

use crate::{
    accounts_host, accounts_selector_host, app_log_host, author_context_host, browser_inventory,
    custom_request_host, followees_host, global_feed_host, home_feed_host,
    host_status::browser_now_ms,
    notifications_feed_host, profile_clipboard_host, profile_feed_host, profile_follow_host,
    relay_settings_host, search_feed_host, settings_host,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_accounts_all, sqlite_storage_stats_snapshot},
    stats_actions_host::stats_actions_provider,
    storage_worker::DEFAULT_WORKER_URL,
    thread_feed_host, tweet_host, upload_settings_host, user_timeline_host, workspace_host,
};

const DEFAULT_DB_NAME: &str = "/lkjstr/main.sqlite3";

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
        let active = active_account_pubkey(&db_name, &worker_url).await;
        lkjstr_ui::mount_app_with_host(startup, providers(db_name, worker_url, active));
    });
}

fn providers(
    db_name: String,
    worker_url: String,
    active_account_pubkey: Option<String>,
) -> HostProviders {
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
        tweet: tweet_host::tweet_provider_with_worker_url(db_name.clone(), worker_url.clone()),
        home_feed: home_feed_host::home_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        followees: followees_host::followees_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        global_feed: global_feed_host::global_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        search_feed: search_feed_host::search_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        custom_request: custom_request_host::custom_request_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        notifications_feed: notifications_feed_host::notifications_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        profile_feed: profile_feed_host::profile_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        author_context_feed: author_context_host::author_context_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        profile_copy: profile_clipboard_host::profile_copy_provider(),
        profile_follow: profile_follow_host::profile_follow_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        thread_feed: thread_feed_host::thread_feed_provider_with_worker_url(
            db_name.clone(),
            worker_url.clone(),
        ),
        user_timeline: user_timeline_host::user_timeline_provider_with_worker_url(
            db_name, worker_url,
        ),
        active_account_pubkey,
    }
}

async fn active_account_pubkey(db_name: &str, worker_url: &str) -> Option<String> {
    let accounts = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await;
    let accounts = match accounts {
        StorageOutcome::Ok(accounts) => accounts,
        _ => return None,
    };
    let selector =
        accounts_selector_host::resolve_active_selector(db_name, worker_url, &accounts).await;
    selector
        .active_id
        .and_then(|id| accounts.into_iter().find(|item| item.id == id))
        .map(|account| account.pubkey)
}

fn workspace_persistence(db_name: String, worker_url: String) -> WorkspacePersistence {
    WorkspacePersistence::with_tab_snapshots(
        {
            let db_name = db_name.clone();
            let worker_url = worker_url.clone();
            move |workspace| {
                let db_name = db_name.clone();
                let worker_url = worker_url.clone();
                wasm_bindgen_futures::spawn_local(async move {
                    let _outcome =
                        workspace_host::workspace_put(&db_name, &worker_url, &workspace).await;
                });
            }
        },
        move |row| {
            let db_name = db_name.clone();
            let worker_url = worker_url.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let _outcome = workspace_host::tab_state_put(&db_name, &worker_url, &row).await;
            });
        },
    )
}

fn stats_provider(db_name: String, worker_url: String) -> lkjstr_ui::StatsProvider {
    let actions = stats_actions_provider(db_name.clone(), worker_url.clone());
    lkjstr_ui::StatsProvider::with_actions(move |complete| {
        let db_name = db_name.clone();
        let worker_url = worker_url.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let snapshot = with_sqlite_store(&db_name, &worker_url, |store| async move {
                StorageOutcome::Ok(sqlite_storage_stats_snapshot(&store).await)
            })
            .await;
            let browser_rows = browser_inventory::browser_inventory_rows().await;
            complete.complete(match snapshot {
                StorageOutcome::Ok(snapshot) => snapshot.with_additional_rows(browser_rows),
                outcome => unavailable_snapshot(outcome).with_additional_rows(browser_rows),
            });
        });
    }, actions)
}

fn unavailable_snapshot<T>(outcome: StorageOutcome<T>) -> lkjstr_storage::StorageStatsSnapshot {
    let reason = outcome
        .problem()
        .map_or("unavailable", |problem| problem.reason);
    lkjstr_storage::StorageStatsSnapshot::manifest_unavailable(reason)
}
