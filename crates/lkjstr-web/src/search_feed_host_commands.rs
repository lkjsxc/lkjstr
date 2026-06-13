use lkjstr_app::{
    FeedFragmentConfig, RowGeometryModel, SearchFeedDiagnosticInput, SearchFeedSourceState,
    SearchFeedView, SearchFeedViewInput, build_search_feed_view,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::SearchOlderRequest;

use crate::{
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    search_feed_cache::search_cache_older_window,
    search_feed_host::{PAGE_SIZE, SearchFeedHost, diagnostic, selected_relays, storage_problem},
    search_feed_relay::start_search_relay_read,
    search_feed_relay_input::{SearchRelayReadInput, SearchRelayReadPhase},
};

pub(crate) fn start_older_request(host: SearchFeedHost, request: SearchOlderRequest) {
    let relay_slot = RelayReadSlot::default();
    let release_slot = relay_slot.clone();
    request.lease().on_release(move || release_slot.cancel());
    wasm_bindgen_futures::spawn_local(async move {
        if request.is_released() {
            return;
        }
        let load = search_older_model(&host, &request).await;
        if !request.is_released() {
            request.complete(load.model);
        }
        if let Some(relay) = load.relay
            && !request.is_released()
            && let Some(handle) =
                start_search_relay_read(relay, move |model| request.complete(model))
        {
            relay_slot.replace(handle);
        }
    });
}

struct SearchOlderLoad {
    model: SearchFeedView,
    relay: Option<SearchRelayReadInput>,
}

async fn search_older_model(host: &SearchFeedHost, request: &SearchOlderRequest) -> SearchOlderLoad {
    let now_sec = browser_now_ms() / 1_000;
    let relays = selected_relays(host).await;
    let mut diagnostics = diagnostics(&relays);
    let selected_relays = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let before = request.window.oldest_cursor.clone();
    let (window, source_state) = search_older_window(host, request, &mut diagnostics).await;
    let relay = older_relay_input(
        request,
        selected_relays.clone(),
        window.clone(),
        diagnostics.clone(),
        now_sec,
        before,
    );
    let model = build_search_feed_view(SearchFeedViewInput {
        owner: request.owner.clone(),
        submitted_query: Some(request.query.clone()),
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
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    SearchOlderLoad { model, relay }
}

async fn search_older_window(
    host: &SearchFeedHost,
    request: &SearchOlderRequest,
    diagnostics: &mut Vec<SearchFeedDiagnosticInput>,
) -> (lkjstr_app::FeedWindowState, SearchFeedSourceState) {
    let Some(before) = request.window.oldest_cursor.clone() else {
        return (request.window.clone(), SearchFeedSourceState::CacheComplete);
    };
    match search_cache_older_window(host, &request.query, request.window.clone(), before).await {
        StorageOutcome::Ok(window) => (window, SearchFeedSourceState::CacheComplete),
        outcome => {
            let reason = storage_problem("Local Search index unavailable", outcome);
            diagnostics.push(diagnostic("local-index", &reason));
            (
                request.window.clone(),
                SearchFeedSourceState::Partial {
                    reason,
                    retry_available: true,
                },
            )
        }
    }
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

fn older_relay_input(
    request: &SearchOlderRequest,
    selected_relays: Vec<String>,
    cache_window: lkjstr_app::FeedWindowState,
    diagnostics: Vec<SearchFeedDiagnosticInput>,
    now_sec: u64,
    before: Option<lkjstr_app::FeedWindowCursor>,
) -> Option<SearchRelayReadInput> {
    let before = before?;
    let query = request.query.trim();
    if selected_relays.is_empty() || query.is_empty() {
        return None;
    }
    Some(SearchRelayReadInput {
        owner: request.owner.clone(),
        query: query.to_owned(),
        selected_relays,
        cache_window,
        diagnostics,
        now_sec,
        phase: SearchRelayReadPhase::Older { before },
    })
}
