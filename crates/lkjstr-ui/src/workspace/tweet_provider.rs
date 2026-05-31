use leptos::prelude::{Callable, Callback};
use lkjstr_domain::{TweetDraft, empty_tweet_draft};

#[derive(Clone)]
pub struct TweetResult {
    pub draft: TweetDraft,
    pub status: String,
}

#[derive(Clone)]
pub struct TweetComplete {
    complete: Callback<TweetResult>,
}

#[derive(Clone)]
pub enum TweetCommand {
    Load(TweetIdCommand),
    Save(TweetDraftCommand),
}

#[derive(Clone)]
pub struct TweetIdCommand {
    pub draft_id: String,
    pub complete: TweetComplete,
}

#[derive(Clone)]
pub struct TweetDraftCommand {
    pub draft: TweetDraft,
    pub complete: TweetComplete,
}

#[derive(Clone)]
pub struct TweetProvider {
    run: Callback<TweetCommand>,
}

impl TweetComplete {
    pub fn complete(&self, result: TweetResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl TweetResult {
    #[must_use]
    pub fn new(draft: TweetDraft, status: impl Into<String>) -> Self {
        Self {
            draft,
            status: status.into(),
        }
    }
}

impl TweetProvider {
    #[must_use]
    pub fn new(run: impl Fn(TweetCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn unavailable() -> Self {
        Self::new(|command| {
            let complete = complete_command(&command).clone();
            let draft_id = draft_id(&command);
            complete.complete(TweetResult::new(
                empty_tweet_draft(draft_id, 0),
                "Tweet draft storage unavailable in this host",
            ));
        })
    }

    pub fn load(&self, draft_id: String, complete: Callback<TweetResult>) {
        self.run.run(TweetCommand::Load(TweetIdCommand {
            draft_id,
            complete: TweetComplete { complete },
        }));
    }

    pub fn save(&self, draft: TweetDraft, complete: Callback<TweetResult>) {
        self.run.run(TweetCommand::Save(TweetDraftCommand {
            draft,
            complete: TweetComplete { complete },
        }));
    }
}

fn complete_command(command: &TweetCommand) -> &TweetComplete {
    match command {
        TweetCommand::Load(command) => &command.complete,
        TweetCommand::Save(command) => &command.complete,
    }
}

fn draft_id(command: &TweetCommand) -> String {
    match command {
        TweetCommand::Load(command) => command.draft_id.clone(),
        TweetCommand::Save(command) => command.draft.id.clone(),
    }
}
