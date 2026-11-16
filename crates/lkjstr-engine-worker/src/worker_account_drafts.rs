//! Account CAS and archive removal share one transaction, including ABA metadata.
use lkjstr_core::engine::{
    account_storage::{Failure, Revision},
    accounts::secret::SecretText,
    dm::drafts,
};
pub(super) async fn commit(
    db: &web_sys::IdbDatabase,
    expected: Revision,
    saved: Option<SecretText>,
    removed: Option<&str>,
    signal: &web_sys::AbortSignal,
) -> Result<Revision, Failure> {
    let removals = if let Some(account) = removed {
        let nonce = lkjstr_nips::hex(
            &crate::browser::random_bytes::<16>().map_err(|_| Failure::Unavailable)?,
        );
        drafts::removal_rows(account, nonce).map_err(|_| Failure::Unavailable)?
    } else {
        vec![]
    };
    match crate::browser::idb_accounts::run(
        db,
        crate::browser::idb_accounts::Change::Commit {
            expected,
            saved,
            removals,
        },
        signal,
    )
    .await?
    {
        crate::browser::idb_accounts::Reply::Committed(next) => Ok(next),
        _ => Err(Failure::Unavailable),
    }
}
