use lkjstr_app::{
    FeedWindowCursor, FeedWindowEvidence, FeedWindowFlags, FeedWindowState, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_GENERIC_REPOST, KIND_REPOST, KIND_TEXT_NOTE};
use lkjstr_relays::ProgressiveEvent;
use lkjstr_storage::{SearchCursor, StorageOutcome, StoredEventRecord};

use crate::{
    search_feed_host::{PAGE_SIZE, SearchFeedHost, WINDOW_MAX},
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_event_relays, sqlite_search_local_query_before},
};

pub(crate) async fn search_cache_window(
    host: &SearchFeedHost,
    query: &str,
) -> StorageOutcome<FeedWindowState> {
    match local_search_page(host, query, None).await {
        StorageOutcome::Ok(page) => StorageOutcome::Ok(window_from_page(
            empty_feed_window(1, WINDOW_MAX),
            page,
        )),
        outcome => outcome.map(|_| empty_feed_window(1, WINDOW_MAX)),
    }
}

pub(crate) async fn search_cache_older_window(
    host: &SearchFeedHost,
    query: &str,
    current: FeedWindowState,
    before: FeedWindowCursor,
) -> StorageOutcome<FeedWindowState> {
    match local_search_page(host, query, Some(before)).await {
        StorageOutcome::Ok(page) => StorageOutcome::Ok(window_from_page(current, page)),
        outcome => outcome.map(|_| empty_feed_window(1, WINDOW_MAX)),
    }
}

struct LocalSearchPage {
    events: Vec<ProgressiveEvent>,
    has_older: bool,
}

async fn local_search_page(
    host: &SearchFeedHost,
    query: &str,
    before: Option<FeedWindowCursor>,
) -> StorageOutcome<LocalSearchPage> {
    let query = query.to_owned();
    let before = before.map(search_cursor_from_feed);
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        let rows = match sqlite_search_local_query_before(&store, &query, PAGE_SIZE + 1, before.as_ref()).await {
            StorageOutcome::Ok(rows) => rows,
            outcome => return outcome.map(|_| empty_local_page()),
        };
        let mut rows = rows
            .into_iter()
            .filter(|row| display_search_kind(row.event.kind))
            .collect::<Vec<_>>();
        let has_older = rows.len() as u64 > PAGE_SIZE;
        rows.truncate(PAGE_SIZE as usize);
        let events = match events_with_relays(&store, rows).await {
            StorageOutcome::Ok(events) => events,
            outcome => return outcome.map(|_| empty_local_page()),
        };
        StorageOutcome::Ok(LocalSearchPage { events, has_older })
    })
    .await
}

fn empty_local_page() -> LocalSearchPage {
    LocalSearchPage {
        events: Vec::new(),
        has_older: false,
    }
}

async fn events_with_relays(
    store: &crate::sqlite_store::SqliteStore,
    rows: Vec<StoredEventRecord>,
) -> StorageOutcome<Vec<ProgressiveEvent>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let relays = match sqlite_event_relays(store, &row.event.id).await {
            StorageOutcome::Ok(rows) => rows.into_iter().map(|item| item.relay_url).collect(),
            outcome => return outcome.map(|_| Vec::new()),
        };
        out.push(ProgressiveEvent {
            relays,
            sub_id: "search-cache".to_owned(),
            event: row.event,
        });
    }
    StorageOutcome::Ok(out)
}

fn window_from_page(state: FeedWindowState, page: LocalSearchPage) -> FeedWindowState {
    reduce_feed_window(
        state,
        FeedWindowEvidence::Events {
            generation: 1,
            events: page.events,
            flags: FeedWindowFlags {
                has_older: page.has_older,
                ..FeedWindowFlags::default()
            },
        },
    )
}

fn search_cursor_from_feed(cursor: FeedWindowCursor) -> SearchCursor {
    SearchCursor {
        created_at: cursor.created_at,
        event_id: cursor.event_id,
    }
}

fn display_search_kind(kind: u64) -> bool {
    [KIND_TEXT_NOTE, KIND_REPOST, KIND_GENERIC_REPOST].contains(&kind)
}
