use lkjstr_domain::empty_tweet_draft;
use lkjstr_storage::{StorageOutcome, TweetDraftRecord};
use lkjstr_ui::{TweetCommand, TweetDraftCommand, TweetIdCommand, TweetProvider, TweetResult};

use crate::indexed_db::tweet_draft_store;

pub fn tweet_provider(db_name: String) -> TweetProvider {
    TweetProvider::new(move |command| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&db_name, command).await;
        });
    })
}

async fn run_command(db_name: &str, command: TweetCommand) {
    match command {
        TweetCommand::Load(command) => load(db_name, command).await,
        TweetCommand::Save(command) => save(db_name, command).await,
    }
}

async fn load(db_name: &str, command: TweetIdCommand) {
    let draft_id = command.draft_id.clone();
    match load_with_legacy(db_name, &draft_id).await {
        StorageOutcome::Ok(Some(mut draft)) => {
            draft.id = draft_id;
            command.complete.complete(TweetResult::new(draft, ""));
        }
        StorageOutcome::Ok(None) => {
            command.complete.complete(TweetResult::new(
                empty_tweet_draft(command.draft_id, browser_now_ms()),
                "",
            ));
        }
        outcome => command.complete.complete(TweetResult::new(
            empty_tweet_draft(command.draft_id, browser_now_ms()),
            problem_status("Tweet draft unavailable", outcome),
        )),
    }
}

async fn save(db_name: &str, command: TweetDraftCommand) {
    let mut draft = command.draft;
    draft.updated_at = browser_now_ms();
    match tweet_draft_store::tweet_draft_put(db_name, &draft).await {
        StorageOutcome::Ok(()) => command
            .complete
            .complete(TweetResult::new(draft, "Draft saved.")),
        outcome => command.complete.complete(TweetResult::new(
            draft,
            problem_status("Draft save failed", outcome),
        )),
    }
}

async fn load_with_legacy(
    db_name: &str,
    draft_id: &str,
) -> StorageOutcome<Option<TweetDraftRecord>> {
    match tweet_draft_store::tweet_draft_get(db_name, draft_id).await {
        StorageOutcome::Ok(Some(row)) => StorageOutcome::Ok(Some(row)),
        StorageOutcome::Ok(None) if draft_id != "main" => {
            tweet_draft_store::tweet_draft_get(db_name, "main").await
        }
        outcome => outcome,
    }
}

fn problem_status<T>(prefix: &str, outcome: StorageOutcome<T>) -> String {
    outcome.problem().map_or_else(
        || prefix.to_owned(),
        |problem| format!("{prefix}: {}", problem.reason),
    )
}

fn browser_now_ms() -> u64 {
    js_sys::Date::now().max(0.0) as u64
}
