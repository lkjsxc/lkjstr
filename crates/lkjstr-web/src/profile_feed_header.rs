use lkjstr_app::{
    ProfileFeedDiagnosticInput, ProfileHeaderInput, ProfileHeaderView, profile_header_view,
};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_METADATA, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    profile_feed_host::ProfileFeedHost,
    profile_feed_status::{diagnostic, storage_problem},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_events_by_author_kind},
};

pub(crate) async fn profile_header_state(
    host: &ProfileFeedHost,
    pubkey: &str,
    diagnostics: &mut Vec<ProfileFeedDiagnosticInput>,
) -> Option<ProfileHeaderView> {
    let metadata = latest_profile_event(host, pubkey, KIND_METADATA, diagnostics).await;
    let follow_list = latest_profile_event(host, pubkey, KIND_FOLLOW_LIST, diagnostics).await;
    Some(profile_header_view(ProfileHeaderInput {
        pubkey,
        metadata_event: metadata.as_ref(),
        follow_list_event: follow_list.as_ref(),
    }))
}

async fn latest_profile_event(
    host: &ProfileFeedHost,
    pubkey: &str,
    kind: u64,
    diagnostics: &mut Vec<ProfileFeedDiagnosticInput>,
) -> Option<NostrEvent> {
    let outcome = cached_latest_profile_event(host, pubkey, kind).await;
    match outcome {
        StorageOutcome::Ok(event) => event.map(|row| row.event),
        other => {
            let reason = storage_problem("Cached Profile header unavailable", other);
            diagnostics.push(diagnostic("profile-header-cache", &reason));
            None
        }
    }
}

async fn cached_latest_profile_event(
    host: &ProfileFeedHost,
    pubkey: &str,
    kind: u64,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        latest_event_from_store(&store, &pubkey, kind).await
    })
    .await
}

async fn latest_event_from_store(
    store: &SqliteStore,
    pubkey: &str,
    kind: u64,
) -> StorageOutcome<Option<StoredEventRecord>> {
    match sqlite_events_by_author_kind(store, pubkey, kind, u64::MAX, 1).await {
        StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
        outcome => outcome.map(|_| None),
    }
}
