use lkjstr_domain::{
    SignerType, create_account, create_local_account_record, parse_nsec, parse_readonly_account,
};
use lkjstr_protocol::encode_nsec;
use lkjstr_storage::{AccountRecord, StorageOutcome};
use lkjstr_ui::{
    AccountsCommand, AccountsComplete, AccountsIdCommand, AccountsInputCommand, AccountsProvider,
    AccountsResult,
};

use crate::accounts_active::{active_account_id, set_active_account_id};
use crate::indexed_db::{account_store, local_secret_store};
use crate::nip07_host::nip07_public_key;

pub fn accounts_provider(db_name: String) -> AccountsProvider {
    AccountsProvider::new(move |command| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&db_name, command).await;
        });
    })
}

async fn run_command(db_name: &str, command: AccountsCommand) {
    match command {
        AccountsCommand::Load(complete) => complete.complete(load_result(db_name, "").await),
        AccountsCommand::AddInput(command) => add_input(db_name, command).await,
        AccountsCommand::ConnectNip07(complete) => connect_nip07(db_name, complete).await,
        AccountsCommand::Activate(command) => activate(db_name, command).await,
        AccountsCommand::Remove(command) => remove_account(db_name, command).await,
        AccountsCommand::Reveal(command) => reveal_secret(db_name, command).await,
    }
}

async fn connect_nip07(db_name: &str, complete: AccountsComplete) {
    let status = match nip07_public_key().await {
        Ok(pubkey) => match create_account(&pubkey, SignerType::Nip07, browser_now_ms()) {
            Some(account) => {
                save_public_account(db_name, &account, "NIP-07 account connected.").await
            }
            None => "NIP-07 signer returned an invalid public key.".to_owned(),
        },
        Err(message) => message,
    };
    complete.complete(load_result(db_name, &status).await);
}

async fn add_input(db_name: &str, command: AccountsInputCommand) {
    let input = command.input.trim();
    if input.is_empty() {
        command
            .complete
            .complete(load_result(db_name, "Account input is empty").await);
        return;
    }
    let now = browser_now_ms();
    if let Some(secret) = parse_nsec(input) {
        let status = match create_local_account_record(Some(&secret), now) {
            Ok((account, secret_row)) => save_local_account(db_name, &account, &secret_row).await,
            Err(_) => "nsec input is invalid.".to_owned(),
        };
        command
            .complete
            .complete(load_result(db_name, &status).await);
        return;
    }
    let status = match parse_readonly_account(input, now) {
        Some(account) => save_public_account(db_name, &account, "Read-only account added.").await,
        None => "Account input is invalid.".to_owned(),
    };
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn activate(db_name: &str, command: AccountsIdCommand) {
    set_active_account_id(Some(&command.account_id));
    command
        .complete
        .complete(load_result(db_name, "Active account updated.").await);
}

async fn remove_account(db_name: &str, command: AccountsIdCommand) {
    let account_status = account_store::account_delete(db_name, &command.account_id).await;
    let _secret = local_secret_store::local_secret_delete(db_name, &command.account_id).await;
    if active_account_id().as_deref() == Some(command.account_id.as_str()) {
        set_active_account_id(None);
    }
    let status = match account_status {
        StorageOutcome::Ok(()) => "Account disconnected.".to_owned(),
        outcome => problem_status("Account disconnect failed", outcome),
    };
    command
        .complete
        .complete(load_result(db_name, &status).await);
}

async fn reveal_secret(db_name: &str, command: AccountsIdCommand) {
    let result = match local_secret_store::local_secret_get(db_name, &command.account_id).await {
        StorageOutcome::Ok(Some(row)) => encode_nsec(&row.secret_key)
            .map(|nsec| ("Local nsec revealed.".to_owned(), Some(nsec)))
            .unwrap_or_else(|_| ("Local secret is invalid.".to_owned(), None)),
        StorageOutcome::Ok(None) => ("Local secret is unavailable.".to_owned(), None),
        outcome => (problem_status("Local secret unavailable", outcome), None),
    };
    let mut loaded = load_result(db_name, &result.0).await;
    if let Some(nsec) = result.1 {
        loaded = loaded.with_revealed_nsec(command.account_id, nsec);
    }
    command.complete.complete(loaded);
}

async fn save_public_account(db_name: &str, account: &AccountRecord, ok: &str) -> String {
    match account_store::account_put(db_name, account).await {
        StorageOutcome::Ok(()) => {
            set_active_account_id(Some(&account.id));
            ok.to_owned()
        }
        outcome => problem_status("Account save failed", outcome),
    }
}

async fn save_local_account(
    db_name: &str,
    account: &AccountRecord,
    secret_row: &lkjstr_domain::LocalAccountSecret,
) -> String {
    match account_store::local_account_put(db_name, account, secret_row).await {
        StorageOutcome::Ok(()) => {
            set_active_account_id(Some(&account.id));
            "Local account added.".to_owned()
        }
        outcome => problem_status("Local account save failed", outcome),
    }
}

async fn load_result(db_name: &str, status: &str) -> AccountsResult {
    match account_store::accounts_all(db_name).await {
        StorageOutcome::Ok(accounts) => {
            let active_id = resolve_active_id(&accounts);
            AccountsResult::new(accounts, active_id, status.to_owned())
        }
        outcome => AccountsResult::new(
            Vec::new(),
            None,
            problem_status("Accounts unavailable", outcome),
        ),
    }
}

fn resolve_active_id(accounts: &[AccountRecord]) -> Option<String> {
    let stored = active_account_id();
    if let Some(id) = stored
        && accounts.iter().any(|account| account.id == id)
    {
        return Some(id);
    }
    let fallback = accounts.first().map(|account| account.id.clone());
    set_active_account_id(fallback.as_deref());
    fallback
}

fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

fn browser_now_ms() -> u64 {
    let now = js_sys::Date::now();
    if now.is_sign_negative() {
        0
    } else {
        now as u64
    }
}
