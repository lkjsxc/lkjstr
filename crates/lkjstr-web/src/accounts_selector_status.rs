use lkjstr_storage::{AccountRecord, StorageOutcome};

use crate::{
    accounts_selector_store::{put_selector_for_account, put_selector_for_existing_account},
    host_status::problem_status,
};

pub async fn selector_update_status(
    db_name: &str,
    worker_url: &str,
    account: &AccountRecord,
) -> String {
    match put_selector_for_existing_account(db_name, worker_url, account).await {
        StorageOutcome::Ok(()) => "Active account updated.".to_owned(),
        outcome => problem_status("Active account selector update failed", outcome),
    }
}

pub async fn selector_save_status(
    db_name: &str,
    worker_url: &str,
    account: &AccountRecord,
    local_secret_available: bool,
    nip07_availability: &str,
    ok: &str,
) -> String {
    match put_selector_for_account(
        db_name,
        worker_url,
        account,
        local_secret_available,
        nip07_availability,
    )
    .await
    {
        StorageOutcome::Ok(()) => ok.to_owned(),
        outcome => join_status(
            ok,
            Some(problem_status(
                "Active account selector write failed",
                outcome,
            )),
        ),
    }
}

pub fn join_status(primary: &str, secondary: Option<String>) -> String {
    match (primary.is_empty(), secondary) {
        (true, Some(secondary)) => secondary,
        (true, None) => String::new(),
        (false, Some(secondary)) => format!("{primary} {secondary}"),
        (false, None) => primary.to_owned(),
    }
}
