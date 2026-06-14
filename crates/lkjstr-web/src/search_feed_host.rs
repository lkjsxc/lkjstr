use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, SearchFeedDiagnosticInput, SearchFeedSourceState,
    SearchFeedView, SearchFeedViewInput, build_search_feed_view, empty_feed_window,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::SearchFeedProvider;

use crate::{
    host_status::{browser_now_ms, problem_status},
    relay_selection::selected_read_relays,
    search_feed_cache::search_cache_window,
    search_feed_geometry::search_feed_geometry_models,
    search_feed_host_commands::start_older_request,
    search_feed_relay::start_search_relay_read,
    search_feed_relay_input::{SearchRelayInputSeed, SearchRelayReadInput, search_relay_input},
    relay_read_handle::RelayReadSlot,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct SearchFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn search_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> SearchFeedProvider {
    let host = SearchFeedHost {
        db_name,
        worker_url,
    };
    let older_host = host.clone();
    SearchFeedProvider::with_older(
        move |request| {
            let host = host.clone();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            request.lease().on_release(move || release_slot.cancel());
            wasm_bindgen_futures::spawn_local(async move {
                let owner = request.owner.clone();
                let query = request.query.clone();
                if request.is_released() {
                    return;
                }
                let load = search_feed_model(&host, &owner, &query).await;
                if request.is_released() {
                    return;
            }
            request.complete(load.model);
            if let Some(relay) = load.relay
                && !request.is_released()
                && let Some(handle) =
                    start_search_relay_read(relay, move |model| request.complete(model))
            {
                relay_slot.replace(handle);
            }
        });
    },
        move |request| start_older_request(older_host.clone(), request),
    )
}

struct SearchFeedLoad {
    model: SearchFeedView,
    relay: Option<SearchRelayReadInput>,
}

async fn search_feed_model(host: &SearchFeedHost, owner: &str, query: &str) -> SearchFeedLoad {
    let now_sec = browser_now_ms() / 1_000;
    let relays = selected_relays(host).await;
    let mut diagnostics = diagnostics(&relays);
    let selected_relays = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let (window, source_state) =
        search_cache_state(host, query, &selected_relays, &mut diagnostics).await;
    let geometry_models =
        search_feed_geometry_models(host, &window, &mut diagnostics, 680, 1.0).await;
    let relay = search_relay_input(SearchRelayInputSeed {
        owner,
        query,
        source_state: &source_state,
        selected_relays: &selected_relays,
        window: &window,
        diagnostics: &diagnostics,
        now_sec,
    });
    let model = build_search_feed_view(SearchFeedViewInput {
        owner: owner.to_owned(),
        submitted_query: Some(query.to_owned()),
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: None,
        until: Some(now_sec),
        now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    SearchFeedLoad { model, relay }
}

async fn search_cache_state(
    host: &SearchFeedHost,
    query: &str,
    selected_relays: &[String],
    diagnostics: &mut Vec<SearchFeedDiagnosticInput>,
) -> (lkjstr_app::FeedWindowState, SearchFeedSourceState) {
    match search_cache_window(host, query).await {
        StorageOutcome::Ok(window) => {
            let state = if selected_relays.is_empty() {
                SearchFeedSourceState::CacheComplete
            } else {
                SearchFeedSourceState::Pending
            };
            (window, state)
        }
        outcome => {
            let reason = storage_problem("Local Search index unavailable", outcome);
            diagnostics.push(diagnostic("local-index", &reason));
            (
                empty_feed_window(1, WINDOW_MAX),
                SearchFeedSourceState::Partial {
                    reason,
                    retry_available: true,
                },
            )
        }
    }
}

pub(crate) async fn selected_relays(host: &SearchFeedHost) -> StorageOutcome<Vec<String>> {
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

fn diagnostics(relays: &StorageOutcome<Vec<String>>) -> Vec<SearchFeedDiagnosticInput> {
    relays
        .problem()
        .map(|problem| {
            vec![diagnostic(
                "relay-settings",
                &format!("Relay settings unavailable: {}", problem.reason),
            )]
        })
        .unwrap_or_default()
}

pub(crate) fn diagnostic(id: &str, message: &str) -> SearchFeedDiagnosticInput {
    SearchFeedDiagnosticInput {
        scope: "search-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

pub(crate) fn storage_problem<T>(label: &str, outcome: StorageOutcome<T>) -> String {
    problem_status(label, outcome)
}
