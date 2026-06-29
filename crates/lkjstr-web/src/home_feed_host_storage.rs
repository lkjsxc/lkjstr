use lkjstr_app::ProtectedAccountAvailability;
use lkjstr_domain::seed_relay_sets;
use lkjstr_storage::StorageOutcome;

use crate::{
    home_feed_host::HomeFeedHost,
    host_status::browser_now_ms,
    protected_account_availability::resolve_protected_account,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) async fn active_account(
    host: &HomeFeedHost,
) -> (ProtectedAccountAvailability, Option<String>) {
    let account = resolve_protected_account(&host.db_name, &host.worker_url).await;
    (account.availability, account.diagnostic)
}

pub(crate) async fn selected_relays(host: &HomeFeedHost) -> StorageOutcome<Vec<String>> {
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
