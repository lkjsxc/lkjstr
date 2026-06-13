use lkjstr_app::{
    FeedFragmentConfig, RowGeometryModel, ThreadFeedSourceState, ThreadFeedView,
    ThreadFeedViewInput, build_thread_feed_view, empty_feed_window,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::ThreadFeedProvider;

use crate::{
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
    thread_feed_cache::thread_cache_state,
    thread_feed_host_commands::{
        complete_read_output, release_owner as release_thread_owner, start_older_request,
    },
    thread_feed_relay::start_thread_relay_read,
    thread_feed_relay_input::{ThreadRelayInputSeed, ThreadRelayReadInput, thread_relay_input},
    thread_feed_relay_state::ThreadRelayState,
    thread_feed_status::diagnostics,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 240;

#[derive(Clone)]
pub(crate) struct ThreadFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn thread_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> ThreadFeedProvider {
    let host = ThreadFeedHost {
        db_name,
        worker_url,
    };
    let relay_state = ThreadRelayState::default();
    let read_state = relay_state.clone();
    ThreadFeedProvider::with_older(
        move |request| {
            let host = host.clone();
            let release_owner = request.owner.clone();
            let release_state = read_state.clone();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            request
                .lease()
                .on_release(release_thread_owner(
                    release_state,
                    release_owner,
                    release_slot,
                ));
            let state = read_state.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let owner = request.owner.clone();
                let event_id = request.event_id.clone();
                if request.is_released() {
                    return;
                }
                let load = thread_feed_model(&host, &owner, event_id).await;
                if request.is_released() {
                    return;
                }
                if let Some(base) = load.base.clone() {
                    state.remember(base);
                } else {
                    state.forget(&owner);
                }
                request.complete(load.model);
                if let Some(relay) = load.relay
                    && !request.is_released()
                {
                    let callback_slot = relay_slot.clone();
                    if let Some(handle) = start_thread_relay_read(relay, move |output| {
                        complete_read_output(&state, &request, output, &callback_slot);
                    }) {
                        relay_slot.replace(handle);
                    }
                }
            });
        },
        move |request| {
            start_older_request(relay_state.clone(), request);
        },
    )
}

struct ThreadFeedLoad {
    model: ThreadFeedView,
    base: Option<ThreadRelayReadInput>,
    relay: Option<ThreadRelayReadInput>,
}

async fn thread_feed_model(
    host: &ThreadFeedHost,
    owner: &str,
    event_id: Option<String>,
) -> ThreadFeedLoad {
    let now_sec = browser_now_ms() / 1_000;
    let relays = selected_relays(host).await;
    let mut diagnostics = diagnostics(&relays);
    let selected = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let cache = match event_id.as_deref() {
        Some(event_id) if !selected.is_empty() => {
            thread_cache_state(host, event_id, &mut diagnostics).await
        }
        _ => empty_cache_state(),
    };
    let relay = thread_relay_input(ThreadRelayInputSeed {
        owner,
        event_id: &event_id,
        root_event_id: &cache.root_event_id,
        root_author: &cache.root_author,
        source_state: &cache.source_state,
        selected_relays: &selected,
        author_routes: &[],
        window: &cache.window,
        diagnostics: &diagnostics,
        now_sec,
    });
    let model = build_thread_feed_view(ThreadFeedViewInput {
        owner: owner.to_owned(),
        event_id,
        root_event_id: cache.root_event_id,
        root_author: cache.root_author,
        source_state: cache.source_state,
        unavailable_parent_ids: Vec::new(),
        selected_relays: selected,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(now_sec.saturating_sub(30)),
        until: None,
        now_sec,
        page_size: PAGE_SIZE,
        window: cache.window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    ThreadFeedLoad {
        model,
        base: relay.clone(),
        relay,
    }
}

async fn selected_relays(host: &ThreadFeedHost) -> StorageOutcome<Vec<String>> {
    let now = browser_now_ms();
    with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        match sqlite_relay_sets_all(&store).await {
            StorageOutcome::Ok(rows) => {
                StorageOutcome::Ok(selected_read_relays(&seed_relay_sets(&rows, now)))
            }
            outcome => outcome.map(|_| Vec::new()),
        }
    })
    .await
}

fn empty_cache_state() -> crate::thread_feed_cache::ThreadCacheState {
    crate::thread_feed_cache::ThreadCacheState {
        window: empty_feed_window(1, WINDOW_MAX),
        source_state: ThreadFeedSourceState::Pending,
        root_event_id: None,
        root_author: None,
    }
}
