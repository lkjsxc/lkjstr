use lkjstr_app::FolloweesProfile;
use lkjstr_protocol::{FollowEntry, KIND_METADATA, NostrEvent};
use lkjstr_storage::{StorageOutcome, StoredEventRecord};
use serde_json::Value;

use crate::{
    followees_host::FolloweesHost,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_events_by_author_kind},
};

pub(crate) async fn cached_followees_profiles(
    host: &FolloweesHost,
    entries: &[FollowEntry],
) -> Vec<FolloweesProfile> {
    let mut profiles = Vec::new();
    for entry in entries {
        let Some(profile) = cached_followee_profile(host, &entry.pubkey).await else {
            continue;
        };
        profiles.push(profile);
    }
    profiles
}

pub(crate) async fn cached_followee_profile(
    host: &FolloweesHost,
    pubkey: &str,
) -> Option<FolloweesProfile> {
    let row = match latest_metadata(host, pubkey).await {
        StorageOutcome::Ok(row) => row,
        _ => None,
    }?;
    profile_from_metadata(pubkey, &row.event)
}

async fn latest_metadata(
    host: &FolloweesHost,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        latest_metadata_from_store(&store, &pubkey).await
    })
    .await
}

async fn latest_metadata_from_store(
    store: &SqliteStore,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    match sqlite_events_by_author_kind(store, pubkey, KIND_METADATA, u64::MAX, 1).await {
        StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
        outcome => outcome.map(|_| None),
    }
}

fn profile_from_metadata(pubkey: &str, event: &NostrEvent) -> Option<FolloweesProfile> {
    if event.kind != KIND_METADATA || event.pubkey != pubkey {
        return None;
    }
    let metadata = serde_json::from_str::<Value>(&event.content).ok()?;
    let display_name = profile_string(&metadata, "display_name")
        .or_else(|| profile_string(&metadata, "name"))
        .or_else(|| profile_string(&metadata, "nip05"));
    let subtitle = profile_string(&metadata, "nip05");
    let avatar_url = profile_string(&metadata, "picture");
    if display_name.is_none() && subtitle.is_none() && avatar_url.is_none() {
        return None;
    }
    Some(FolloweesProfile {
        pubkey: pubkey.to_owned(),
        display_name,
        subtitle,
        avatar_url,
    })
}

fn profile_string(metadata: &Value, field: &str) -> Option<String> {
    metadata
        .get(field)?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}
