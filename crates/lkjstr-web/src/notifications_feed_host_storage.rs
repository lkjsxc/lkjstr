use lkjstr_domain::{Account, seed_relay_sets};
use lkjstr_storage::StorageOutcome;

use crate::{
    accounts_selector_host::resolve_active_selector,
    host_status::{browser_now_ms, problem_status},
    notifications_feed_host::NotificationsFeedHost,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_accounts_all, sqlite_relay_sets_all},
};

pub(crate) async fn active_account(
    host: &NotificationsFeedHost,
) -> (Option<Account>, Option<String>) {
    let accounts = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await;
    let accounts = match accounts {
        StorageOutcome::Ok(accounts) => accounts,
        outcome => return (None, Some(problem_status("Accounts unavailable", outcome))),
    };
    let selector = resolve_active_selector(&host.db_name, &host.worker_url, &accounts).await;
    let account = selector
        .active_id
        .and_then(|id| accounts.into_iter().find(|item| item.id == id));
    (account, selector.status)
}

pub(crate) async fn selected_relays(host: &NotificationsFeedHost) -> StorageOutcome<Vec<String>> {
    let now = browser_now_ms();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(selected_read_relays(&seed_relay_sets(&rows, now)))
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}
