use lkjstr_domain::SignerType;
use lkjstr_storage::{AccountRecord, ActiveAccountSelectorRecord, StorageOutcome};

use crate::{
    accounts_active::{clear_legacy_active_account_id, legacy_active_account_id},
    host_status::{browser_now_ms, problem_status},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        sqlite_active_account_selector_delete, sqlite_active_account_selector_get,
        sqlite_active_account_selector_put, sqlite_local_secret_get,
    },
};

pub async fn selector_get(
    db_name: &str,
    worker_url: &str,
) -> StorageOutcome<Option<ActiveAccountSelectorRecord>> {
    with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_active_account_selector_get(&store).await
    })
    .await
}

pub async fn put_selector_for_account(
    db_name: &str,
    worker_url: &str,
    account: &AccountRecord,
    local_secret_available: bool,
    nip07_availability: &str,
) -> StorageOutcome<()> {
    let row = ActiveAccountSelectorRecord::for_account(
        account,
        local_secret_available,
        nip07_availability,
        browser_now_ms(),
    );
    let outcome = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_active_account_selector_put(&store, &row).await
    })
    .await;
    clear_legacy_on_ok(&outcome);
    outcome
}

pub async fn put_selector_for_existing_account(
    db_name: &str,
    worker_url: &str,
    account: &AccountRecord,
) -> StorageOutcome<()> {
    let local_secret = local_secret_available(db_name, worker_url, account).await;
    put_selector_for_account(
        db_name,
        worker_url,
        account,
        local_secret,
        nip07_state(account),
    )
    .await
}

pub async fn delete_selector_if_account_active(
    db_name: &str,
    worker_url: &str,
    account_id: &str,
) -> Option<String> {
    match selector_get(db_name, worker_url).await {
        StorageOutcome::Ok(Some(row)) if row.selected_account_id.as_deref() == Some(account_id) => {
            match delete_selector(db_name, worker_url).await {
                StorageOutcome::Ok(()) => None,
                outcome => Some(problem_status(
                    "Active account selector delete failed",
                    outcome,
                )),
            }
        }
        StorageOutcome::Ok(_) => {
            clear_matching_legacy(account_id);
            None
        }
        outcome => Some(problem_status(
            "Active account selector unavailable",
            outcome,
        )),
    }
}

async fn delete_selector(db_name: &str, worker_url: &str) -> StorageOutcome<()> {
    let outcome = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_active_account_selector_delete(&store).await
    })
    .await;
    clear_legacy_on_ok(&outcome);
    outcome
}

async fn local_secret_available(db_name: &str, worker_url: &str, account: &AccountRecord) -> bool {
    if account.signer_type != SignerType::Local {
        return false;
    }
    let account_id = account.id.clone();
    matches!(
        with_sqlite_store(db_name, worker_url, |store| async move {
            sqlite_local_secret_get(&store, &account_id).await
        })
        .await,
        StorageOutcome::Ok(Some(_))
    )
}

fn nip07_state(account: &AccountRecord) -> &'static str {
    match account.signer_type {
        SignerType::Nip07 => "unknown",
        SignerType::Local | SignerType::Readonly => "not-applicable",
    }
}

fn clear_matching_legacy(account_id: &str) {
    if legacy_active_account_id().as_deref() == Some(account_id) {
        clear_legacy_active_account_id();
    }
}

fn clear_legacy_on_ok<T>(outcome: &StorageOutcome<T>) {
    if outcome.is_ok() {
        clear_legacy_active_account_id();
    }
}
