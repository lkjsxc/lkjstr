use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedView,
    AuthorContextFeedViewInput, FeedFragmentConfig, FeedWindowState, RowGeometryModel,
    build_author_context_feed_view, default_author_context_feed_view,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::{AuthorRelayRoute, DemandVisibility};
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::AuthorContextFeedProvider;

use crate::{
    author_context_cache::author_context_cache_state,
    author_context_relay::start_author_context_relay_read,
    author_context_relay_input::{
        AuthorContextRelayInputSeed, AuthorContextRelayReadInput, author_context_relay_input,
    },
    author_context_routes::{author_routes, route_diagnostic},
    host_status::browser_now_ms,
    relay_read_handle::RelayReadSlot,
    relay_selection::selected_read_relays,
    sqlite_host_store::with_sqlite_store,
    sqlite_store::sqlite_relay_sets_all,
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
    let selected = match selected_relays(host).await {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
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
    let relay = author_context_relay_input(AuthorContextRelayInputSeed {
        owner,
        event_id: &Some(event_id_value.clone()),
        author_pubkey: &Some(author_pubkey_value.clone()),
        source_state: &cache.source_state,
        selected_relays: &selected,
        author_routes: &routes,
        window: &cache.window,
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
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: parts.diagnostics,
    })
}

async fn selected_relays(host: &AuthorContextHost) -> StorageOutcome<Vec<String>> {
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
