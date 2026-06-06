use lkjstr_domain::empty_tweet_draft;
use lkjstr_storage::{StorageOutcome, TweetDraftRecord};
use lkjstr_ui::{TweetCommand, TweetDraftCommand, TweetIdCommand, TweetProvider, TweetResult};

use crate::{
    host_status::{browser_now_ms, problem_status},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_tweet_draft_get, sqlite_tweet_draft_put},
};

#[derive(Clone)]
struct TweetHost {
    db_name: String,
    worker_url: String,
}

pub fn tweet_provider_with_worker_url(db_name: String, worker_url: String) -> TweetProvider {
    let host = TweetHost {
        db_name,
        worker_url,
    };
    TweetProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &TweetHost, command: TweetCommand) {
    match command {
        TweetCommand::Load(command) => load(host, command).await,
        TweetCommand::Save(command) => save(host, command).await,
    }
}

async fn load(host: &TweetHost, command: TweetIdCommand) {
    let draft_id = command.draft_id.clone();
    match load_with_main_fallback(host, &draft_id).await {
        StorageOutcome::Ok(Some(mut draft)) => {
            draft.id = draft_id;
            command.complete.complete(TweetResult::new(draft, ""));
        }
        StorageOutcome::Ok(None) => command
            .complete
            .complete(empty_result(command.draft_id, "")),
        outcome => command.complete.complete(empty_result(
            command.draft_id,
            &problem_status("Tweet draft unavailable", outcome),
        )),
    }
}

async fn save(host: &TweetHost, command: TweetDraftCommand) {
    let mut draft = command.draft;
    draft.updated_at = browser_now_ms();
    let stored = draft.clone();
    let outcome = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_tweet_draft_put(&store, &stored).await
    })
    .await;
    match outcome {
        StorageOutcome::Ok(()) => command
            .complete
            .complete(TweetResult::new(draft, "Draft saved.")),
        outcome => command.complete.complete(TweetResult::new(
            draft,
            problem_status("Draft save failed", outcome),
        )),
    }
}

async fn load_with_main_fallback(
    host: &TweetHost,
    draft_id: &str,
) -> StorageOutcome<Option<TweetDraftRecord>> {
    match load_one(host, draft_id).await {
        StorageOutcome::Ok(Some(row)) => StorageOutcome::Ok(Some(row)),
        StorageOutcome::Ok(None) if draft_id != "main" => load_one(host, "main").await,
        outcome => outcome,
    }
}

async fn load_one(host: &TweetHost, draft_id: &str) -> StorageOutcome<Option<TweetDraftRecord>> {
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_tweet_draft_get(&store, draft_id).await
    })
    .await
}

fn empty_result(draft_id: String, status: &str) -> TweetResult {
    TweetResult::new(empty_tweet_draft(draft_id, browser_now_ms()), status)
}
