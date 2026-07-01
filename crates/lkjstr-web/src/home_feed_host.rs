use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, HomeFeedDiagnosticInput, HomeFeedSourceState,
    HomeFeedView, HomeFeedViewInput, HomeFollowState, build_home_feed_view, empty_feed_window,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_ui::HomeFeedProvider;

use crate::{
    home_feed_cache::home_cache_state,
    home_feed_geometry::home_feed_geometry_models,
    home_feed_host_relay::start_home_relay_command,
    home_feed_host_storage::{active_account, selected_relays},
    home_feed_relay_input::{HomeRelayCommand, HomeRelayInputSeed, home_relay_input},
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;
const VIEW_WIDTH_PX: u16 = 680;
const VIEW_FONT_SCALE: f32 = 1.0;

#[derive(Clone)]
pub(crate) struct HomeFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
    pub(crate) page_active_pubkey: Option<String>,
}

pub fn home_feed_provider_with_worker_url(db_name: String, worker_url: String) -> HomeFeedProvider {
    home_feed_provider_with_page_account(db_name, worker_url, None)
}

pub(crate) fn home_feed_provider_with_page_account(
    db_name: String,
    worker_url: String,
    page_active_pubkey: Option<String>,
) -> HomeFeedProvider {
    let host = HomeFeedHost {
        db_name,
        worker_url,
        page_active_pubkey,
    };
    HomeFeedProvider::new(move |request| {
        let host = host.clone();
        let relay_slot = RelayReadSlot::default();
        let release_slot = relay_slot.clone();
        request.lease().on_release(move || release_slot.cancel());
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            if request.is_released() {
                return;
            }
            let load = home_feed_model(&host, &owner).await;
            if request.is_released() {
                return;
            }
            request.complete(load.model);
            if let Some(relay) = load.relay
                && !request.is_released()
            {
                start_home_relay_command(relay, request, relay_slot);
            }
        });
    })
}

struct HomeFeedLoad {
    model: HomeFeedView,
    relay: Option<HomeRelayCommand>,
}

async fn home_feed_model(host: &HomeFeedHost, owner: &str) -> HomeFeedLoad {
    let now_ms = browser_now_ms();
    let now_sec = now_ms / 1_000;
    let (account, account_diagnostic) = active_account(host).await;
    let relay_plan = selected_relays(host).await;
    let active_pubkey = account.active_pubkey().map(str::to_owned);
    let mut diagnostics = diagnostics(account_diagnostic, relay_plan.diagnostic.as_deref());
    let selected_relays = relay_plan.relays;
    let (follow_state, window, source_state) = match active_pubkey.as_deref() {
        Some(pubkey) if !selected_relays.is_empty() => {
            home_cache_state(
                host,
                pubkey,
                owner,
                &selected_relays,
                now_sec,
                &mut diagnostics,
            )
            .await
        }
        _ => (
            HomeFollowState::Loading,
            empty_feed_window(1, WINDOW_MAX),
            HomeFeedSourceState::Pending,
        ),
    };
    let geometry_models = home_feed_geometry_models(
        host,
        &window,
        &mut diagnostics,
        VIEW_WIDTH_PX,
        VIEW_FONT_SCALE,
    )
    .await;
    let relay = home_relay_input(HomeRelayInputSeed {
        owner,
        active_pubkey: &active_pubkey,
        follow_state: &follow_state,
        source_state: &source_state,
        selected_relays: &selected_relays,
        window: &window,
        geometry_models: &geometry_models,
        diagnostics: &diagnostics,
        now_sec,
    });
    let model = build_home_feed_view(HomeFeedViewInput {
        owner: owner.to_owned(),
        account,
        follow_state,
        source_state,
        selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
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
    HomeFeedLoad { model, relay }
}

fn diagnostics(
    account: Option<String>,
    relay_message: Option<&str>,
) -> Vec<HomeFeedDiagnosticInput> {
    let mut out = account
        .map(|message| vec![diagnostic("active-account", &message)])
        .unwrap_or_default();
    if let Some(message) = relay_message {
        out.push(diagnostic("relay-settings", message));
    }
    out
}

pub(crate) fn diagnostic(id: &str, message: &str) -> HomeFeedDiagnosticInput {
    HomeFeedDiagnosticInput {
        scope: "home-provider".to_owned(),
        id: id.to_owned(),
        severity: FeedDiagnosticSeverity::Warning,
        message: message.to_owned(),
    }
}
