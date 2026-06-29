use lkjstr_app::ProtectedAccountAvailability;
use lkjstr_domain::Account;
use lkjstr_storage::StorageOutcome;

use crate::{
    accounts_selector_host::resolve_active_selector,
    host_status::problem_status,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_accounts_all,
};

pub(crate) struct ProtectedAccountResolution {
    pub(crate) availability: ProtectedAccountAvailability,
    pub(crate) diagnostic: Option<String>,
}

pub(crate) async fn resolve_protected_account(
    db_name: &str,
    worker_url: &str,
) -> ProtectedAccountResolution {
    let accounts = with_sqlite_store(db_name, worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await;
    let accounts = match accounts {
        StorageOutcome::Ok(accounts) => accounts,
        outcome => return storage_resolution("Accounts unavailable", outcome),
    };
    if accounts.is_empty() {
        return resolved(ProtectedAccountAvailability::NoAccounts, None);
    }
    let selector = resolve_active_selector(db_name, worker_url, &accounts).await;
    match selector.active_id {
        Some(id) => selected_account(accounts, &id, selector.status),
        None => selector_unavailable(selector.status),
    }
}

fn selected_account(
    accounts: Vec<Account>,
    account_id: &str,
    diagnostic: Option<String>,
) -> ProtectedAccountResolution {
    let availability = accounts
        .into_iter()
        .find(|item| item.id == account_id)
        .map(|item| ProtectedAccountAvailability::selected(item.pubkey))
        .unwrap_or(ProtectedAccountAvailability::NoSelectedAccount);
    resolved(availability, diagnostic)
}

fn selector_unavailable(diagnostic: Option<String>) -> ProtectedAccountResolution {
    match diagnostic {
        Some(reason) => resolved(
            ProtectedAccountAvailability::SelectorUnavailable {
                reason: reason.clone(),
                retry_available: true,
            },
            Some(reason),
        ),
        None => resolved(ProtectedAccountAvailability::NoSelectedAccount, None),
    }
}

fn storage_resolution<T>(label: &str, outcome: StorageOutcome<T>) -> ProtectedAccountResolution {
    let reason = problem_status(label, outcome.map(|_| ()));
    let availability = match outcome_kind(&reason) {
        AccountProblemKind::Busy => ProtectedAccountAvailability::StorageBusy {
            reason: reason.clone(),
            retry_available: true,
        },
        AccountProblemKind::Unsupported => {
            ProtectedAccountAvailability::StorageUnsupported { reason: reason.clone() }
        }
        AccountProblemKind::Blocked => ProtectedAccountAvailability::StorageBlocked {
            reason: reason.clone(),
            retry_available: false,
        },
    };
    resolved(availability, Some(reason))
}

enum AccountProblemKind {
    Busy,
    Blocked,
    Unsupported,
}

fn outcome_kind(reason: &str) -> AccountProblemKind {
    if reason.contains("opfs-owner-held")
        || reason.contains("sahpool-lock-conflict")
        || reason.contains("busy")
        || reason.contains("timeout")
        || reason.contains("cancel")
        || reason.contains("late-")
    {
        return AccountProblemKind::Busy;
    }
    if reason.contains("unavailable-browser-capability")
        || reason.contains("web-lock-unavailable")
    {
        return AccountProblemKind::Unsupported;
    }
    AccountProblemKind::Blocked
}

fn resolved(
    availability: ProtectedAccountAvailability,
    diagnostic: Option<String>,
) -> ProtectedAccountResolution {
    ProtectedAccountResolution {
        availability,
        diagnostic,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_storage::{StorageOperation, StorageProblem, StorageProblemKind};

    #[test]
    fn busy_accounts_read_maps_to_protected_storage_busy() {
        let resolution = storage_resolution(
            "Accounts unavailable",
            StorageOutcome::<()>::Busy(StorageProblem::with_kind(
                StorageOperation::Read,
                "accounts",
                StorageProblemKind::Busy,
                "accounts-read",
            )),
        );

        assert_eq!(
            resolution.availability,
            ProtectedAccountAvailability::StorageBusy {
                reason: "Accounts unavailable: busy".to_owned(),
                retry_available: true,
            }
        );
        assert_eq!(
            resolution.diagnostic,
            Some("Accounts unavailable: busy".to_owned())
        );
    }

    #[test]
    fn selector_failure_maps_to_selector_unavailable() {
        let resolution = selector_unavailable(Some(
            "Active account selector unavailable: opfs-owner-held".to_owned(),
        ));

        assert_eq!(
            resolution.availability,
            ProtectedAccountAvailability::SelectorUnavailable {
                reason: "Active account selector unavailable: opfs-owner-held".to_owned(),
                retry_available: true,
            }
        );
    }
}
