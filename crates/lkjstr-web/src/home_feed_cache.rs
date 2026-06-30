use lkjstr_app::{
    FeedWindowEvidence, FeedWindowFlags, HomeFeedDiagnosticInput, HomeFeedSourceState,
    HomeFollowState, empty_feed_window, home_authors, home_feed_id, reduce_feed_window,
    summarize_follow_list,
};
use lkjstr_protocol::KIND_FOLLOW_LIST;
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{StorageOutcome, StoredEventRecord};

use crate::{
    home_feed_cache_events::cached_events,
    home_feed_cache_filter::cache_complete_filter,
    home_feed_coverage::{HomeCoverageInput, home_coverage_source_state},
    home_feed_host::{HomeFeedHost, WINDOW_MAX, diagnostic},
    host_status::problem_status,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_events_by_author_kind, sqlite_feed_coverage_for_feed},
};

pub(crate) async fn home_cache_state(
    host: &HomeFeedHost,
    active_pubkey: &str,
    owner: &str,
    selected_relays: &[String],
    now_sec: u64,
    diagnostics: &mut Vec<HomeFeedDiagnosticInput>,
) -> (
    HomeFollowState,
    lkjstr_app::FeedWindowState,
    HomeFeedSourceState,
) {
    let follow = latest_follow_list(host, active_pubkey).await;
    let follow_pubkeys = match follow {
        StorageOutcome::Ok(Some(event)) => summarize_follow_list(&event.event)
            .entries
            .into_iter()
            .map(|entry| entry.pubkey)
            .collect::<Vec<_>>(),
        StorageOutcome::Ok(None) => {
            return loading_follow();
        }
        outcome => return unavailable_follow(&problem_status("Follow list unavailable", outcome)),
    };
    let authors = home_authors(active_pubkey, &follow_pubkeys);
    let source_state = cache_source_state(
        host,
        owner,
        active_pubkey,
        &follow_pubkeys,
        selected_relays,
        now_sec,
    )
    .await;
    let filter = cache_complete_filter(&source_state, selected_relays, now_sec);
    let events = cached_events(host, authors, filter).await;
    let window = match events {
        StorageOutcome::Ok(events) => window_from_events(events),
        outcome => {
            diagnostics.push(diagnostic(
                "cache-events",
                &problem_status("Cached Home events unavailable", outcome),
            ));
            empty_feed_window(1, WINDOW_MAX)
        }
    };
    (
        HomeFollowState::Loaded { follow_pubkeys },
        window,
        source_state,
    )
}

async fn latest_follow_list(
    host: &HomeFeedHost,
    pubkey: &str,
) -> StorageOutcome<Option<StoredEventRecord>> {
    let pubkey = pubkey.to_owned();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_events_by_author_kind(&store, &pubkey, KIND_FOLLOW_LIST, u64::MAX, 1).await {
            StorageOutcome::Ok(mut rows) => StorageOutcome::Ok(rows.pop()),
            outcome => outcome.map(|_| None),
        }
    })
    .await
}

async fn cache_source_state(
    host: &HomeFeedHost,
    owner: &str,
    active_pubkey: &str,
    follow_pubkeys: &[String],
    selected_relays: &[String],
    now_sec: u64,
) -> HomeFeedSourceState {
    let feed_key = home_feed_id(owner);
    let coverage = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_feed_coverage_for_feed(&store, &feed_key).await
    })
    .await;
    match coverage {
        StorageOutcome::Ok(rows) => home_coverage_source_state(
            &rows,
            HomeCoverageInput {
                owner,
                active_pubkey,
                follow_pubkeys,
                selected_relays,
                since: now_sec.saturating_sub(30),
                until: now_sec,
            },
        ),
        outcome => HomeFeedSourceState::Partial {
            reason: problem_status("Feed coverage unavailable", outcome),
            retry_available: true,
        },
    }
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

fn loading_follow() -> (
    HomeFollowState,
    lkjstr_app::FeedWindowState,
    HomeFeedSourceState,
) {
    (
        HomeFollowState::Loading,
        empty_feed_window(1, WINDOW_MAX),
        HomeFeedSourceState::Pending,
    )
}

fn unavailable_follow(
    reason: &str,
) -> (
    HomeFollowState,
    lkjstr_app::FeedWindowState,
    HomeFeedSourceState,
) {
    (
        HomeFollowState::Unavailable {
            reason: reason.to_owned(),
            retry_available: true,
        },
        empty_feed_window(1, WINDOW_MAX),
        HomeFeedSourceState::Pending,
    )
}
