use lkjstr_app::{
    FeedDiagnosticSeverity, FeedFragmentConfig, HomeFeedDiagnosticInput, HomeFeedSourceState,
    HomeFeedView, HomeFeedViewInput, HomeFollowState, RowGeometryModel, build_home_feed_view,
    empty_feed_window,
};
use lkjstr_domain::{Account, seed_relay_sets};
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::HomeFeedProvider;

use crate::{
    accounts_selector_host::resolve_active_selector,
    home_feed_cache::home_cache_state,
    home_feed_relay::start_home_relay_read,
    home_feed_relay_input::{HomeRelayInputSeed, HomeRelayReadInput, home_relay_input},
    host_status::{browser_now_ms, problem_status},
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{sqlite_accounts_all, sqlite_relay_sets_all},
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct HomeFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn home_feed_provider_with_worker_url(db_name: String, worker_url: String) -> HomeFeedProvider {
    let host = HomeFeedHost {
        db_name,
        worker_url,
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
                && let Some(handle) =
                    start_home_relay_read(relay, move |model| request.complete(model))
            {
                relay_slot.replace(handle);
            }
        });
    })
}

struct HomeFeedLoad {
    model: HomeFeedView,
    relay: Option<HomeRelayReadInput>,
}

async fn home_feed_model(host: &HomeFeedHost, owner: &str) -> HomeFeedLoad {
    let now_ms = browser_now_ms();
    let now_sec = now_ms / 1_000;
    let (account, account_diagnostic) = active_account(host).await;
    let relays = selected_relays(host).await;
    let active_pubkey = account.as_ref().map(|item| item.pubkey.clone());
    let mut diagnostics = diagnostics(account_diagnostic, &relays);
    let selected_relays = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
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
    let relay = home_relay_input(HomeRelayInputSeed {
        owner,
        active_pubkey: &active_pubkey,
        follow_state: &follow_state,
        source_state: &source_state,
        selected_relays: &selected_relays,
        window: &window,
        diagnostics: &diagnostics,
        now_sec,
    });
    let model = build_home_feed_view(HomeFeedViewInput {
        owner: owner.to_owned(),
        active_pubkey,
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
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    HomeFeedLoad { model, relay }
}

async fn active_account(host: &HomeFeedHost) -> (Option<Account>, Option<String>) {
    let accounts = with_sqlite_store(&host.db_name, &host.worker_url, |store| async move {
        sqlite_accounts_all(&store).await
    })
    .await;
    let accounts = match accounts {
        StorageOutcome::Ok(accounts) => accounts,
        outcome => {
            return (None, Some(problem_status("Accounts unavailable", outcome)));
        }
    };
    let selector = resolve_active_selector(&host.db_name, &host.worker_url, &accounts).await;
    let account = selector
        .active_id
        .and_then(|id| accounts.into_iter().find(|item| item.id == id));
    (account, selector.status)
}

async fn selected_relays(host: &HomeFeedHost) -> StorageOutcome<Vec<String>> {
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

fn diagnostics(
    account: Option<String>,
    relays: &StorageOutcome<Vec<String>>,
) -> Vec<HomeFeedDiagnosticInput> {
    let mut out = account
        .map(|message| vec![diagnostic("active-account", &message)])
        .unwrap_or_default();
    if let Some(problem) = relays.problem() {
        out.push(diagnostic(
            "relay-settings",
            &format!("Relay settings unavailable: {}", problem.reason),
        ));
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
