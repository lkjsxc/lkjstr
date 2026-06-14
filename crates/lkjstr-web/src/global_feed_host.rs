use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, GlobalFeedDiagnosticInput, GlobalFeedSourceState,
    GlobalFeedView, GlobalFeedViewInput, build_global_feed_view, empty_feed_window,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::GlobalFeedProvider;

use crate::{
    global_feed_cache::global_cache_state,
    global_feed_geometry::global_feed_geometry_models,
    global_feed_host_commands::{
        complete_read_output, release_owner as release_global_owner, start_older_request,
    },
    global_feed_relay::start_global_relay_read,
    global_feed_relay_input::{
        GlobalRelayInputSeed, GlobalRelayReadInput, global_base_relay_input, global_relay_input,
    },
    global_feed_relay_state::GlobalRelayState,
    host_status::{browser_now_ms, problem_status},
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;
const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;

#[derive(Clone)]
pub(crate) struct GlobalFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn global_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> GlobalFeedProvider {
    let host = GlobalFeedHost {
        db_name,
        worker_url,
    };
    let relay_state = GlobalRelayState::default();
    let read_state = relay_state.clone();
    GlobalFeedProvider::with_older(
        move |request| {
            let host = host.clone();
            let release_owner = request.owner.clone();
            let release_state = read_state.clone();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            request
                .lease()
                .on_release(release_global_owner(
                    release_state,
                    release_owner,
                    release_slot,
                ));
            let state = read_state.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let owner = request.owner.clone();
                if request.is_released() {
                    return;
                }
                let load = global_feed_model(&host, &owner).await;
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
                    && let Some(handle) = start_global_relay_read(relay, move |output| {
                        complete_read_output(&state, &request, output);
                    })
                {
                    relay_slot.replace(handle);
                }
            });
        },
        move |request| {
            start_older_request(relay_state.clone(), request);
        },
    )
}

struct GlobalFeedLoad {
    model: GlobalFeedView,
    base: Option<GlobalRelayReadInput>,
    relay: Option<GlobalRelayReadInput>,
}

async fn global_feed_model(host: &GlobalFeedHost, owner: &str) -> GlobalFeedLoad {
    let now_sec = browser_now_ms() / 1_000;
    let relays = selected_relays(host).await;
    let mut diagnostics = diagnostics(&relays);
    let selected_relays = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let (window, source_state) = if selected_relays.is_empty() {
        (
            empty_feed_window(1, WINDOW_MAX),
            GlobalFeedSourceState::Pending,
        )
    } else {
        global_cache_state(host, owner, &selected_relays, now_sec, &mut diagnostics).await
    };
    let geometry_models =
        global_feed_geometry_models(host, &window, &mut diagnostics, VIEW_WIDTH_PX, VIEW_FONT_SCALE)
            .await;
    let seed = GlobalRelayInputSeed {
        owner,
        source_state: &source_state,
        selected_relays: &selected_relays,
        window: &window,
        diagnostics: &diagnostics,
        now_sec,
    };
    let base = global_base_relay_input(seed);
    let relay = global_relay_input(seed);
    let model = build_global_feed_view(GlobalFeedViewInput {
        owner: owner.to_owned(),
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(now_sec.saturating_sub(30)),
        now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: VIEW_WIDTH_PX,
        font_scale: VIEW_FONT_SCALE,
        geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    GlobalFeedLoad { model, base, relay }
}

async fn selected_relays(host: &GlobalFeedHost) -> StorageOutcome<Vec<String>> {
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

fn diagnostics(relays: &StorageOutcome<Vec<String>>) -> Vec<GlobalFeedDiagnosticInput> {
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

pub(crate) fn diagnostic(id: &str, message: &str) -> GlobalFeedDiagnosticInput {
    GlobalFeedDiagnosticInput {
        scope: "global-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}

pub(crate) fn storage_problem<T>(label: &str, outcome: StorageOutcome<T>) -> String {
    problem_status(label, outcome)
}
