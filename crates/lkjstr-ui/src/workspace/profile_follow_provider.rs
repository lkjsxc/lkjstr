use leptos::prelude::{Callable, Callback};

#[derive(Clone)]
pub struct ProfileFollowProvider {
    run: Callback<ProfileFollowCommand>,
}

#[derive(Clone)]
pub enum ProfileFollowCommand {
    Load(ProfileFollowLoadCommand),
    Toggle(ProfileFollowToggleCommand),
}

#[derive(Clone)]
pub struct ProfileFollowLoadCommand {
    pub account_pubkey: String,
    pub target_pubkey: String,
    pub complete: ProfileFollowComplete,
}

#[derive(Clone)]
pub struct ProfileFollowToggleCommand {
    pub account_pubkey: String,
    pub target_pubkey: String,
    pub follow: bool,
    pub current: bool,
    pub complete: ProfileFollowComplete,
}

#[derive(Clone)]
pub struct ProfileFollowComplete {
    complete: Callback<ProfileFollowResult>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProfileFollowResult {
    pub following: bool,
    pub status: String,
}

impl ProfileFollowComplete {
    pub fn complete(&self, result: ProfileFollowResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl ProfileFollowResult {
    #[must_use]
    pub fn new(following: bool, status: impl Into<String>) -> Self {
        Self {
            following,
            status: status.into(),
        }
    }
}

impl ProfileFollowProvider {
    #[must_use]
    pub fn new(run: impl Fn(ProfileFollowCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn unavailable() -> Self {
        Self::new(|command| match command {
            ProfileFollowCommand::Load(command) => command
                .complete
                .complete(ProfileFollowResult::new(false, "")),
            ProfileFollowCommand::Toggle(command) => {
                command.complete.complete(ProfileFollowResult::new(
                    command.current,
                    "Profile follow publishing is not available in this host.",
                ));
            }
        })
    }

    pub fn load(
        &self,
        account_pubkey: String,
        target_pubkey: String,
        complete: Callback<ProfileFollowResult>,
    ) {
        self.run
            .run(ProfileFollowCommand::Load(ProfileFollowLoadCommand {
                account_pubkey,
                target_pubkey,
                complete: ProfileFollowComplete { complete },
            }));
    }

    pub fn toggle(
        &self,
        account_pubkey: String,
        target_pubkey: String,
        follow: bool,
        current: bool,
        complete: Callback<ProfileFollowResult>,
    ) {
        self.run
            .run(ProfileFollowCommand::Toggle(ProfileFollowToggleCommand {
                account_pubkey,
                target_pubkey,
                follow,
                current,
                complete: ProfileFollowComplete { complete },
            }));
    }
}
