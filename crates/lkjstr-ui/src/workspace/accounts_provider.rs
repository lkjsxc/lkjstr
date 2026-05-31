use leptos::prelude::{Callable, Callback};
use lkjstr_domain::Account;

#[derive(Clone)]
pub struct AccountsResult {
    pub accounts: Vec<Account>,
    pub active_id: Option<String>,
    pub status: String,
    pub revealed_nsec: Option<(String, String)>,
}

#[derive(Clone)]
pub struct AccountsComplete {
    complete: Callback<AccountsResult>,
}

#[derive(Clone)]
pub enum AccountsCommand {
    Load(AccountsComplete),
    AddInput(AccountsInputCommand),
    ConnectNip07(AccountsComplete),
    Activate(AccountsIdCommand),
    Remove(AccountsIdCommand),
    Reveal(AccountsIdCommand),
}

#[derive(Clone)]
pub struct AccountsInputCommand {
    pub input: String,
    pub complete: AccountsComplete,
}

#[derive(Clone)]
pub struct AccountsIdCommand {
    pub account_id: String,
    pub complete: AccountsComplete,
}

#[derive(Clone)]
pub struct AccountsProvider {
    run: Callback<AccountsCommand>,
}

impl AccountsComplete {
    pub fn complete(&self, result: AccountsResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl AccountsResult {
    #[must_use]
    pub fn new(
        accounts: Vec<Account>,
        active_id: Option<String>,
        status: impl Into<String>,
    ) -> Self {
        Self {
            accounts,
            active_id,
            status: status.into(),
            revealed_nsec: None,
        }
    }

    #[must_use]
    pub fn with_revealed_nsec(mut self, account_id: String, nsec: String) -> Self {
        self.revealed_nsec = Some((account_id, nsec));
        self
    }
}

impl AccountsProvider {
    #[must_use]
    pub fn new(run: impl Fn(AccountsCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn storage_unavailable() -> Self {
        Self::new(|command| {
            complete_command(command).complete(AccountsResult::new(
                Vec::new(),
                None,
                "Account storage unavailable in this host",
            ));
        })
    }

    pub fn load(&self, complete: Callback<AccountsResult>) {
        self.run
            .run(AccountsCommand::Load(AccountsComplete { complete }));
    }

    pub fn add_input(&self, input: String, complete: Callback<AccountsResult>) {
        self.run
            .run(AccountsCommand::AddInput(AccountsInputCommand {
                input,
                complete: AccountsComplete { complete },
            }));
    }

    pub fn connect_nip07(&self, complete: Callback<AccountsResult>) {
        self.run
            .run(AccountsCommand::ConnectNip07(AccountsComplete { complete }));
    }

    pub fn activate(&self, account_id: String, complete: Callback<AccountsResult>) {
        self.run.run(AccountsCommand::Activate(AccountsIdCommand {
            account_id,
            complete: AccountsComplete { complete },
        }));
    }

    pub fn remove(&self, account_id: String, complete: Callback<AccountsResult>) {
        self.run.run(AccountsCommand::Remove(AccountsIdCommand {
            account_id,
            complete: AccountsComplete { complete },
        }));
    }

    pub fn reveal(&self, account_id: String, complete: Callback<AccountsResult>) {
        self.run.run(AccountsCommand::Reveal(AccountsIdCommand {
            account_id,
            complete: AccountsComplete { complete },
        }));
    }
}

fn complete_command(command: AccountsCommand) -> AccountsComplete {
    match command {
        AccountsCommand::Load(complete) => complete,
        AccountsCommand::AddInput(command) => command.complete,
        AccountsCommand::ConnectNip07(complete) => complete,
        AccountsCommand::Activate(command)
        | AccountsCommand::Remove(command)
        | AccountsCommand::Reveal(command) => command.complete,
    }
}
