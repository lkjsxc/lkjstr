use lkjstr_app::summarize_follow_list;
use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord};
use lkjstr_ui::{
    ProfileFollowCommand, ProfileFollowLoadCommand, ProfileFollowProvider, ProfileFollowResult,
    ProfileFollowToggleCommand,
};

use crate::{
    host_status::problem_status,
    profile_follow_mutation::publish_follow_toggle,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_events_by_author_kind},
};

#[derive(Clone)]
pub(crate) struct ProfileFollowHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub(crate) fn profile_follow_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> ProfileFollowProvider {
    let host = ProfileFollowHost {
        db_name,
        worker_url,
    };
    ProfileFollowProvider::new(move |command| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            run_command(&host, command).await;
        });
    })
}

async fn run_command(host: &ProfileFollowHost, command: ProfileFollowCommand) {
    match command {
        ProfileFollowCommand::Load(command) => load(host, command).await,
        ProfileFollowCommand::Toggle(command) => toggle(host, command).await,
    }
}

async fn load(host: &ProfileFollowHost, command: ProfileFollowLoadCommand) {
    command
        .complete
        .complete(cached_follow_state(host, &command.account_pubkey, &command.target_pubkey).await);
}

async fn toggle(host: &ProfileFollowHost, command: ProfileFollowToggleCommand) {
    let complete = command.complete.clone();
    complete.complete(publish_follow_toggle(host, command).await);
}

async fn cached_follow_state(
    host: &ProfileFollowHost,
    account_pubkey: &str,
    target_pubkey: &str,
) -> ProfileFollowResult {
    match latest_follow_list(host, account_pubkey).await {
        StorageOutcome::Ok(Some(row)) => result_from_event(&row.event, target_pubkey, ""),
        StorageOutcome::Ok(None) => ProfileFollowResult::new(false, ""),
        outcome => ProfileFollowResult::new(
            false,
            problem_status("Profile follow state unavailable", outcome),
        ),
    }
}

async fn latest_follow_list(
    host: &ProfileFollowHost,
    account_pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = account_pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        latest_follow_list_from_store(&store, &pubkey).await
    })
    .await
}

pub(crate) async fn latest_follow_list_from_store(
    store: &SqliteStore,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    match sqlite_events_by_author_kind(store, pubkey, KIND_FOLLOW_LIST, u64::MAX, 1).await {
        StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
        outcome => outcome.map(|_| None),
    }
}

pub(crate) fn result_from_event(
    event: &NostrEvent,
    target_pubkey: &str,
    status: impl Into<String>,
) -> ProfileFollowResult {
    let following = summarize_follow_list(event)
        .entries
        .iter()
        .any(|entry| entry.pubkey == target_pubkey);
    ProfileFollowResult::new(following, status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follow_state_uses_real_kind3_p_tags() {
        let event = NostrEvent {
            id: "1".repeat(64),
            pubkey: "a".repeat(64),
            created_at: 1,
            kind: KIND_FOLLOW_LIST,
            tags: vec![vec!["p".to_owned(), "b".repeat(64)]],
            content: String::new(),
            sig: "2".repeat(128),
        };

        assert!(result_from_event(&event, &"b".repeat(64), "").following);
        assert!(!result_from_event(&event, &"c".repeat(64), "").following);
    }
}
