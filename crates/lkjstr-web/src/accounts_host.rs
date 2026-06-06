use lkjstr_domain::{
    SignerType, create_account, create_local_account_record, parse_nsec, parse_readonly_account,
};
use lkjstr_protocol::encode_nsec;
use lkjstr_storage::{AccountRecord, StorageOutcome};
use lkjstr_ui::{
    AccountsCommand, AccountsComplete, AccountsIdCommand, AccountsInputCommand, AccountsProvider,
    AccountsResult,
};

use crate::{
    accounts_active::{active_account_id, set_active_account_id},
    host_status::{browser_now_ms, problem_status},
    nip07_host::nip07_public_key,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        sqlite_account_delete, sqlite_account_put, sqlite_accounts_all, sqlite_local_account_put,
        sqlite_local_secret_delete, sqlite_local_secret_get,
    },
};

#[derive(Clone)]
struct AccountsHost {
    db_name: String,
    worker_url: String,
}

pub fn accounts_provider_with_worker_url(db_name: String, worker_url: String) -> AccountsProvider {
    let host = AccountsHost {
        db_name,
        worker_url,
    };
    AccountsProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &AccountsHost, command: AccountsCommand) {
    match command {
        AccountsCommand::Load(complete) => complete.complete(load_result(host, "").await),
        AccountsCommand::AddInput(command) => add_input(host, command).await,
        AccountsCommand::ConnectNip07(complete) => connect_nip07(host, complete).await,
        AccountsCommand::Activate(command) => activate(host, command).await,
        AccountsCommand::Remove(command) => remove_account(host, command).await,
        AccountsCommand::Reveal(command) => reveal_secret(host, command).await,
    }
}

async fn connect_nip07(host: &AccountsHost, complete: AccountsComplete) {
    let status = match nip07_public_key().await {
        Ok(pubkey) => match create_account(&pubkey, SignerType::Nip07, browser_now_ms()) {
            Some(account) => save_public_account(host, &account, "NIP-07 account connected.").await,
            None => "NIP-07 signer returned an invalid public key.".to_owned(),
        },
        Err(message) => message,
    };
    complete.complete(load_result(host, &status).await);
}

async fn add_input(host: &AccountsHost, command: AccountsInputCommand) {
    let input = command.input.trim();
    if input.is_empty() {
        command
            .complete
            .complete(load_result(host, "Account input is empty").await);
        return;
    }
    let status = account_input_status(host, input).await;
    command.complete.complete(load_result(host, &status).await);
}

async fn account_input_status(host: &AccountsHost, input: &str) -> String {
    let now = browser_now_ms();
    if let Some(secret) = parse_nsec(input) {
        return match create_local_account_record(Some(&secret), now) {
            Ok((account, secret_row)) => save_local_account(host, &account, &secret_row).await,
            Err(_) => "nsec input is invalid.".to_owned(),
        };
    }
    match parse_readonly_account(input, now) {
        Some(account) => save_public_account(host, &account, "Read-only account added.").await,
        None => "Account input is invalid.".to_owned(),
    }
}

async fn activate(host: &AccountsHost, command: AccountsIdCommand) {
    set_active_account_id(Some(&command.account_id));
    command
        .complete
        .complete(load_result(host, "Active account updated.").await);
}

async fn remove_account(host: &AccountsHost, command: AccountsIdCommand) {
    let account_id = command.account_id.clone();
    let account_status = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_account_delete(&store, &account_id).await
    })
    .await;
    let secret_id = command.account_id.clone();
    let _secret = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_local_secret_delete(&store, &secret_id).await
    })
    .await;
    if active_account_id().as_deref() == Some(command.account_id.as_str()) {
        set_active_account_id(None);
    }
    let status = match account_status {
        StorageOutcome::Ok(()) => "Account disconnected.".to_owned(),
        outcome => problem_status("Account disconnect failed", outcome),
    };
    command.complete.complete(load_result(host, &status).await);
}

async fn reveal_secret(host: &AccountsHost, command: AccountsIdCommand) {
    let account_id = command.account_id.clone();
    let result = match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_local_secret_get(&store, &account_id).await
    })
    .await
    {
        StorageOutcome::Ok(Some(row)) => encode_nsec(&row.secret_key)
            .map(|nsec| ("Local nsec revealed.".to_owned(), Some(nsec)))
            .unwrap_or_else(|_| ("Local secret is invalid.".to_owned(), None)),
        StorageOutcome::Ok(None) => ("Local secret is unavailable.".to_owned(), None),
        outcome => (problem_status("Local secret unavailable", outcome), None),
    };
    let mut loaded = load_result(host, &result.0).await;
    if let Some(nsec) = result.1 {
        loaded = loaded.with_revealed_nsec(command.account_id, nsec);
    }
    command.complete.complete(loaded);
}

async fn save_public_account(host: &AccountsHost, account: &AccountRecord, ok: &str) -> String {
    match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_account_put(&store, account).await
    })
    .await
    {
        StorageOutcome::Ok(()) => {
            set_active_account_id(Some(&account.id));
            ok.to_owned()
        }
        outcome => problem_status("Account save failed", outcome),
    }
}

async fn save_local_account(
    host: &AccountsHost,
    account: &AccountRecord,
    secret_row: &lkjstr_domain::LocalAccountSecret,
) -> String {
    match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_local_account_put(&store, account, secret_row).await
    })
    .await
    {
        StorageOutcome::Ok(()) => {
            set_active_account_id(Some(&account.id));
            "Local account added.".to_owned()
        }
        outcome => problem_status("Local account save failed", outcome),
    }
}

async fn load_result(host: &AccountsHost, status: &str) -> AccountsResult {
    match with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await
    {
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
