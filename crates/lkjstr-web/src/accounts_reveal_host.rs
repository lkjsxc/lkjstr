use lkjstr_protocol::encode_nsec;
use lkjstr_storage::StorageOutcome;

use crate::{
    host_status::problem_status, sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_local_secret_get,
};

pub async fn reveal_secret_result(
    db_name: &str,
    worker_url: &str,
    account_id: String,
) -> (String, Option<String>) {
    match with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_local_secret_get(&store, &account_id).await
    })
    .await
    {
        StorageOutcome::Ok(Some(row)) => encode_nsec(&row.secret_key)
            .map(|nsec| ("Local nsec revealed.".to_owned(), Some(nsec)))
            .unwrap_or_else(|_| ("Local secret is invalid.".to_owned(), None)),
        StorageOutcome::Ok(None) => ("Local secret is unavailable.".to_owned(), None),
        outcome => (problem_status("Local secret unavailable", outcome), None),
    }
}
