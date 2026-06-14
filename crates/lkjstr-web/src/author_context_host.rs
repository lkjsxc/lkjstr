use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedView,
    AuthorContextFeedViewInput, FeedFragmentConfig, FeedWindowState, RowGeometryModel,
    build_author_context_feed_view, default_author_context_feed_view,
};
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::AuthorContextFeedProvider;

use crate::{
    author_context_cache::author_context_cache_state,
    author_context_geometry::author_context_geometry_models,
    author_context_relay::start_author_context_relay_read,
    author_context_relay_input::{
        AuthorContextRelayInputSeed, AuthorContextRelayReadInput, author_context_relay_input,
    },
    author_context_routes::{author_routes, route_diagnostic},
    author_context_selected_relays::selected_relays,
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct AuthorContextHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

struct AuthorContextModelParts {
    event_id: Option<String>,
    author_pubkey: Option<String>,
    selected_relays: Vec<String>,
    author_routes: Vec<AuthorRelayRoute>,
    window: FeedWindowState,
    source_state: AuthorContextFeedSourceState,
    anchor_created_at: Option<u64>,
    geometry_models: Vec<RowGeometryModel>,
    diagnostics: Vec<AuthorContextFeedDiagnosticInput>,
}

pub(crate) fn author_context_feed_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> AuthorContextFeedProvider {
    let host = AuthorContextHost {
        db_name,
        worker_url,
    };
    AuthorContextFeedProvider::new(move |request| {
        let host = host.clone();
        let relay_slot = RelayReadSlot::default();
        let release_slot = relay_slot.clone();
        request.lease().on_release(move || release_slot.cancel());
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            let event_id = request.event_id.clone();
            let author_pubkey = request.author_pubkey.clone();
            if request.is_released() {
                return;
            }
            let load = author_context_model(&host, &owner, event_id, author_pubkey).await;
            if request.is_released() {
                return;
            }
            request.complete(load.model);
            if let Some(relay) = load.relay
                && !request.is_released()
            {
                let relay_request = request.clone();
                if let Some(handle) = start_author_context_relay_read(relay, move |model| {
                    relay_request.complete(model);
                }) {
                    relay_slot.replace(handle);
                }
            }
        });
    })
}

struct AuthorContextFeedLoad {
    model: AuthorContextFeedView,
    relay: Option<AuthorContextRelayReadInput>,
}

async fn author_context_model(
    host: &AuthorContextHost,
    owner: &str,
    event_id: Option<String>,
    author_pubkey: Option<String>,
) -> AuthorContextFeedLoad {
    let Some(event_id_value) = event_id.clone() else {
        return load_without_relay(default_author_context_feed_view(
            owner,
            event_id,
            author_pubkey,
        ));
    };
    let Some(author_pubkey_value) = author_pubkey.clone() else {
        return load_without_relay(default_author_context_feed_view(
            owner,
            event_id,
            author_pubkey,
        ));
    };
    let now_ms = browser_now_ms();
    let now_sec = now_ms / 1_000;
    let selected = selected_relays(host).await;
    let mut diagnostics = Vec::<AuthorContextFeedDiagnosticInput>::new();
    let routes = author_routes(host, &author_pubkey_value, now_ms).await;
    if let Some(diagnostic) = route_diagnostic(&routes) {
        diagnostics.push(diagnostic);
    }
    let routes = match routes {
        StorageOutcome::Ok(routes) => routes,
        _ => Vec::new(),
    };
    let cache = author_context_cache_state(
        host,
        &event_id_value,
        &author_pubkey_value,
        &mut diagnostics,
    )
    .await;
    let geometry_models =
        author_context_geometry_models(host, &cache.window, &mut diagnostics, 680, 1.0).await;
    let relay = author_context_relay_input(AuthorContextRelayInputSeed {
        owner,
        event_id: &Some(event_id_value.clone()),
        author_pubkey: &Some(author_pubkey_value.clone()),
        source_state: &cache.source_state,
        selected_relays: &selected,
        author_routes: &routes,
        window: &cache.window,
        geometry_models: &geometry_models,
        diagnostics: &diagnostics,
        anchor_created_at: cache.anchor_created_at,
        now_sec,
    });
    let model = build_view(
        owner,
        AuthorContextModelParts {
            event_id,
            author_pubkey,
            selected_relays: selected,
            author_routes: routes,
            window: cache.window,
            source_state: cache.source_state,
            anchor_created_at: cache.anchor_created_at,
            geometry_models,
            diagnostics,
        },
    );
    AuthorContextFeedLoad { model, relay }
}

fn load_without_relay(model: AuthorContextFeedView) -> AuthorContextFeedLoad {
    AuthorContextFeedLoad { model, relay: None }
}

fn build_view(owner: &str, parts: AuthorContextModelParts) -> AuthorContextFeedView {
    build_author_context_feed_view(AuthorContextFeedViewInput {
        owner: owner.to_owned(),
        event_id: parts.event_id,
        author_pubkey: parts.author_pubkey,
        source_state: parts.source_state,
        selected_relays: parts.selected_relays,
        disabled_relays: Vec::new(),
        author_routes: parts.author_routes,
        visibility: DemandVisibility::Visible,
        anchor_created_at: parts.anchor_created_at,
        now_sec: browser_now_ms() / 1_000,
        page_size: PAGE_SIZE,
        window: parts.window,
        width_px: 680,
        font_scale: 1.0,
        geometry_models: parts.geometry_models,
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: parts.diagnostics,
    })
}
