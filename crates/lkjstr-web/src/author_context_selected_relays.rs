use lkjstr_domain::seed_relay_sets;
use lkjstr_storage::StorageOutcome;

use crate::{
    author_context_host::AuthorContextHost,
    host_status::browser_now_ms,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) async fn selected_relays(host: &AuthorContextHost) -> Vec<String> {
    let now = browser_now_ms();
    match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_relay_sets_all(&store)
            .await
            .map(|rows| selected_read_relays(&seed_relay_sets(&rows, now)))
    })
    .await
    {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    }
}
