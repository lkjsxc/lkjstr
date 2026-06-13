use lkjstr_app::{
    FeedFragmentConfig, ProfileFeedSourceState, ProfileFeedView, ProfileFeedViewInput,
    build_profile_feed_view, empty_feed_window, relay_sets_copy_json,
};
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::ProfileFeedProvider;

use crate::{
    host_status::browser_now_ms,
    profile_feed_cache::profile_cache_state,
    profile_feed_header::profile_header_state,
    profile_feed_header_relay::start_profile_header_relay_read,
    profile_feed_header_relay_input::{
        ProfileHeaderRelayInputSeed, ProfileHeaderRelayReadInput, profile_header_relay_input,
    },
    profile_feed_relay::start_profile_relay_read,
    profile_feed_relay_input::{ProfileRelayInputSeed, ProfileRelayReadInput, profile_relay_input},
    profile_feed_routes::{author_routes, diagnostics, query_selected_relays, relay_sets},
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct ProfileFeedHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub fn profile_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> ProfileFeedProvider {
    let host = ProfileFeedHost {
        db_name,
        worker_url,
    };
    ProfileFeedProvider::new(move |request| {
        let host = host.clone();
        let header_slot = RelayReadSlot::default();
        let feed_slot = RelayReadSlot::default();
        let release_header_slot = header_slot.clone();
        let release_feed_slot = feed_slot.clone();
        request.lease().on_release(move || {
            release_header_slot.cancel();
            release_feed_slot.cancel();
        });
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            let pubkey = request.profile_pubkey.clone();
            if request.is_released() {
                return;
            }
            let load = profile_feed_model(&host, &owner, pubkey).await;
            if request.is_released() {
                return;
            }
            request.complete(load.model);
            if let Some(header_relay) = load.header_relay
                && !request.is_released()
            {
                let request = request.clone();
                if let Some(handle) =
                    start_profile_header_relay_read(host.clone(), header_relay, move |model| {
                        request.complete(model);
                    })
                {
                    header_slot.replace(handle);
                }
            }
            if let Some(relay) = load.relay
                && !request.is_released()
            {
                let request = request.clone();
                if let Some(handle) = start_profile_relay_read(relay, move |model| {
                    request.complete(model);
                }) {
                    feed_slot.replace(handle);
                }
            }
        });
    })
}

struct ProfileFeedLoad {
    model: ProfileFeedView,
    relay: Option<ProfileRelayReadInput>,
    header_relay: Option<ProfileHeaderRelayReadInput>,
}

async fn profile_feed_model(
    host: &ProfileFeedHost,
    owner: &str,
    profile_pubkey: Option<String>,
) -> ProfileFeedLoad {
    let now_ms = browser_now_ms();
    let now_sec = now_ms / 1_000;
    let stored_relay_sets = relay_sets(host).await;
    let relays = stored_relay_sets.clone().map(|sets| selected_read_relays(&sets));
    let relay_sets_json = match &stored_relay_sets {
        StorageOutcome::Ok(sets) => relay_sets_copy_json(sets),
        _ => "[]".to_owned(),
    };
    let routes = match profile_pubkey.as_deref() {
        Some(pubkey) => author_routes(host, pubkey, now_ms).await,
        None => StorageOutcome::Ok(Vec::new()),
    };
    let mut diagnostics = diagnostics(&relays, &routes);
    let selected = match relays {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let routes = match routes {
        StorageOutcome::Ok(routes) => routes,
        _ => Vec::new(),
    };
    let profile_header = match profile_pubkey.as_deref() {
        Some(pubkey) => profile_header_state(host, pubkey, &mut diagnostics).await,
        None => None,
    };
    let query_relays = query_selected_relays(&selected, &routes);
    let (window, source_state) = match profile_pubkey.as_deref() {
        Some(pubkey) if !query_relays.is_empty() || !routes.is_empty() => {
            profile_cache_state(
                host,
                owner,
                pubkey,
                &query_relays,
                &routes,
                now_sec,
                &mut diagnostics,
            )
            .await
        }
        _ => (
            empty_feed_window(1, WINDOW_MAX),
            ProfileFeedSourceState::Pending,
        ),
    };
    let relay = profile_relay_input(ProfileRelayInputSeed {
        owner,
        profile_pubkey: &profile_pubkey,
        source_state: &source_state,
        selected_relays: &query_relays,
        profile_hint_relays: &selected,
        relay_sets_json: &relay_sets_json,
        author_routes: &routes,
        profile_header: &profile_header,
        window: &window,
        diagnostics: &diagnostics,
        now_sec,
    });
    let header_relay = profile_header_relay_input(ProfileHeaderRelayInputSeed {
        owner,
        profile_pubkey: &profile_pubkey,
        selected_relays: &selected,
        view_selected_relays: &query_relays,
        relay_sets_json: &relay_sets_json,
        author_routes: &routes,
        profile_header: &profile_header,
        window: &window,
        source_state: &source_state,
        diagnostics: &diagnostics,
        now_sec,
    });
    let model = build_profile_feed_view(ProfileFeedViewInput {
        owner: owner.to_owned(),
        profile_pubkey,
        profile_header,
        source_state,
        selected_relays: query_relays,
        profile_hint_relays: selected,
        relay_sets_json,
        disabled_relays: Vec::new(),
        author_routes: routes,
        visibility: DemandVisibility::Visible,
        since: Some(now_sec.saturating_sub(30)),
        now_sec,
        page_size: PAGE_SIZE,
        window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics,
    });
    ProfileFeedLoad {
        model,
        relay,
        header_relay,
    }
}
