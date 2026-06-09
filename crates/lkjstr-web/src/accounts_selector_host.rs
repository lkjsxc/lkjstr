use lkjstr_storage::{AccountRecord, StorageOutcome};

use crate::{
    accounts_active::legacy_active_account_id,
    accounts_selector_store::{put_selector_for_existing_account, selector_get},
    host_status::problem_status,
};

pub struct ActiveSelectorResolution {
    pub active_id: Option<String>,
    pub status: Option<String>,
}

pub async fn resolve_active_selector(
    db_name: &str,
    worker_url: &str,
    accounts: &[AccountRecord],
) -> ActiveSelectorResolution {
    if accounts.is_empty() {
        return resolution(None, None);
    }
    match selector_get(db_name, worker_url).await {
        StorageOutcome::Ok(Some(selector)) => {
            resolve_sqlite_selector(
                db_name,
                worker_url,
                accounts,
                selector.selected_account_id.as_deref(),
            )
            .await
        }
        StorageOutcome::Ok(None) => resolve_missing_selector(db_name, worker_url, accounts).await,
        outcome => resolution(
            None,
            Some(problem_status(
                "Active account selector unavailable",
                outcome,
            )),
        ),
    }
}

async fn resolve_sqlite_selector(
    db_name: &str,
    worker_url: &str,
    accounts: &[AccountRecord],
    selector_id: Option<&str>,
) -> ActiveSelectorResolution {
    if let Some(id) = selector_id
        && accounts.iter().any(|account| account.id == id)
    {
        return resolution(Some(id.to_owned()), None);
    }
    fallback_selector(
        db_name,
        worker_url,
        accounts,
        Some("Active account selector reset to a stored account.".to_owned()),
    )
    .await
}

async fn resolve_missing_selector(
    db_name: &str,
    worker_url: &str,
    accounts: &[AccountRecord],
) -> ActiveSelectorResolution {
    if let Some(id) = legacy_active_account_id()
        && let Some(account) = accounts.iter().find(|account| account.id == id)
    {
        return migrate_legacy_selector(db_name, worker_url, account).await;
    }
    fallback_selector(db_name, worker_url, accounts, None).await
}

async fn migrate_legacy_selector(
    db_name: &str,
    worker_url: &str,
    account: &AccountRecord,
) -> ActiveSelectorResolution {
    match put_selector_for_existing_account(db_name, worker_url, account).await {
        StorageOutcome::Ok(()) => resolution(Some(account.id.clone()), None),
        outcome => resolution(
            Some(account.id.clone()),
            Some(problem_status(
                "Active account selector migration failed",
                outcome,
            )),
        ),
    }
}

async fn fallback_selector(
    db_name: &str,
    worker_url: &str,
    accounts: &[AccountRecord],
    status: Option<String>,
) -> ActiveSelectorResolution {
    let Some(account) = accounts.first() else {
        return resolution(None, status);
    };
    let write_status = match put_selector_for_existing_account(db_name, worker_url, account).await {
        StorageOutcome::Ok(()) => None,
        outcome => Some(problem_status(
            "Active account selector write failed",
            outcome,
        )),
    };
    resolution(
        Some(account.id.clone()),
        combine_status(status, write_status),
    )
}

fn resolution(active_id: Option<String>, status: Option<String>) -> ActiveSelectorResolution {
    ActiveSelectorResolution { active_id, status }
}

fn combine_status(first: Option<String>, second: Option<String>) -> Option<String> {
    match (first, second) {
        (Some(first), Some(second)) => Some(format!("{first} {second}")),
        (Some(first), None) => Some(first),
        (None, Some(second)) => Some(second),
        (None, None) => None,
    }
}
