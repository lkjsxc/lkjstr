use std::collections::BTreeMap;

use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, ProfileFeedDiagnosticInput, ProfileFeedSourceState,
    empty_feed_window, profile_feed_id, reduce_feed_window,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::{AuthorRelayRoute, ProgressiveEvent};
use lkjstr_storage::{FeedCoverageRecord, StorageOutcome, StoredEventRecord};

use crate::{
    profile_feed_cache_filter::ProfileCacheFilter,
    profile_feed_coverage::{ProfileCoverageInput, profile_coverage_source_state},
    profile_feed_host::{PAGE_SIZE, ProfileFeedHost, WINDOW_MAX},
    profile_feed_status::{diagnostic, storage_problem},
    profile_feed_sparse::{ProfileSparseInput, profile_sparse_decision},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{
        sqlite_event_relays, sqlite_events_by_author_kind, sqlite_feed_coverage_for_feed,
    },
};

pub(crate) async fn profile_cache_state(
    host: &ProfileFeedHost,
    owner: &str,
    profile_pubkey: &str,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    now_sec: u64,
    diagnostics: &mut Vec<ProfileFeedDiagnosticInput>,
) -> (lkjstr_app::FeedWindowState, ProfileFeedSourceState) {
    let (source_state, coverage_rows) = cache_source_state(
        host,
        owner,
        profile_pubkey,
        selected_relays,
        author_routes,
        now_sec,
    )
    .await;
    let filter = ProfileCacheFilter::new(&source_state, selected_relays, author_routes, now_sec);
    let events = cached_events(host, profile_pubkey, filter).await;
    let window = match events {
        StorageOutcome::Ok(events) => window_from_events(events),
        outcome => {
            diagnostics.push(diagnostic(
                "cache-events",
                &storage_problem("Cached Profile events unavailable", outcome),
            ));
            empty_feed_window(1, WINDOW_MAX)
        }
    };
    let sparse = profile_sparse_decision(ProfileSparseInput {
        owner,
        profile_pubkey,
        selected_relays,
        author_routes,
        now_sec,
        source_state: &source_state,
        current_window_empty: window.visible_events().is_empty(),
        coverage_rows: &coverage_rows,
    });
    if let Some(range) = sparse.cache_range
        && window.visible_events().is_empty()
    {
        let filter = ProfileCacheFilter::with_range(selected_relays, author_routes, Some(range));
        if let StorageOutcome::Ok(events) = cached_events(host, profile_pubkey, filter).await {
            return (window_from_events(events), sparse.source_state);
        }
    }
    (window, sparse.source_state)
}

async fn cache_source_state(
    host: &ProfileFeedHost,
    owner: &str,
    profile_pubkey: &str,
    selected_relays: &[String],
    author_routes: &[AuthorRelayRoute],
    now_sec: u64,
) -> (ProfileFeedSourceState, Vec<FeedCoverageRecord>) {
    let feed_key = profile_feed_id(owner);
    let coverage = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_feed_coverage_for_feed(&store, &feed_key).await
    })
    .await;
    match coverage {
        StorageOutcome::Ok(rows) => {
            let state = profile_coverage_source_state(
                &rows,
                ProfileCoverageInput {
                    owner,
                    profile_pubkey,
                    selected_relays,
                    author_routes,
                    since: now_sec.saturating_sub(30),
                    until: now_sec,
                },
            );
            (state, rows)
        }
        outcome => (
            ProfileFeedSourceState::Partial {
                reason: storage_problem("Feed coverage unavailable", outcome),
                retry_available: true,
            },
            Vec::new(),
        ),
    }
}

async fn cached_events(
    host: &ProfileFeedHost,
    profile_pubkey: &str,
    filter: ProfileCacheFilter,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let pubkey = profile_pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let mut by_id = BTreeMap::<String, StoredEventRecord>::new();
        for kind in [KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST] {
            let rows = match sqlite_events_by_author_kind(
                &store,
                &pubkey,
                kind,
                u64::MAX,
                PAGE_SIZE,
            )
            .await
            {
                StorageOutcome::Ok(rows) => rows,
                outcome => return outcome.map(|_| Vec::new()),
            };
            for row in rows {
                if filter.accepts_event(&row) {
                    by_id.entry(row.event.id.clone()).or_insert(row);
                }
            }
        }
        events_with_relays(&store, by_id, filter).await
    })
    .await
}

async fn events_with_relays(
    store: &crate::sqlite_store::SqliteStore,
    rows: BTreeMap<String, StoredEventRecord>,
    filter: ProfileCacheFilter,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows.into_values() {
        let relays: Vec<String> = match sqlite_event_relays(store, &row.event.id).await {
            StorageOutcome::Ok(rows) => rows.into_iter().map(|item| item.relay_url).collect(),
            outcome => return outcome.map(|_| Vec::new()),
        };
        if !filter.accepts_relays(&relays) {
            continue;
        }
        out.push(ProgressiveEvent {
            relays,
            sub_id: "profile-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}

fn window_from_events(events: Vec<ProgressiveEvent>) -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, WINDOW_MAX),
        FeedWindowEvidence::Events {
            generation: 1,
            events,
            flags: FeedWindowFlags::default(),
        },
    )
}
