//! Removing an account and its private archive is one committed storage operation.
use lkjstr_core::engine::dm::drafts;
pub(super) async fn commit(
    db: &web_sys::IdbDatabase,
    saved: String,
    removed: Option<&str>,
) -> Result<(), &'static str> {
    let mut rows = vec![("engine-accounts".to_owned(), Some(saved))];
    if let Some(account) = removed {
        let nonce = lkjstr_nips::hex(&crate::browser::random_bytes::<16>()?);
        rows.extend(drafts::removal_rows(account, nonce)?);
    }
    crate::browser::idb::kv_commit(db, &rows)
        .await
        .map_err(|_| "internal")
}
