use lkjstr_app::{
    AuthorContextFeedDiagnosticInput, AuthorContextFeedSourceState, AuthorContextFeedView,
    AuthorContextFeedViewInput, FeedFragmentConfig, FeedWindowState, RowGeometryModel,
    build_author_context_feed_view, default_author_context_feed_view,
};
use lkjstr_domain::seed_relay_sets;
use lkjstr_relays::DemandVisibility;
use lkjstr_storage::StorageOutcome;
use lkjstr_ui::AuthorContextFeedProvider;

use crate::{
    author_context_cache::author_context_cache_state, host_status::browser_now_ms,
    relay_selection::selected_read_relays, sqlite_host_store::with_sqlite_store,
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
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            let event_id = request.event_id.clone();
            let author_pubkey = request.author_pubkey.clone();
            if request.is_released() {
                return;
            }
            let model = author_context_model(&host, &owner, event_id, author_pubkey).await;
            if !request.is_released() {
                request.complete(model);
            }
        });
    })
}

async fn author_context_model(
    host: &AuthorContextHost,
    owner: &str,
    event_id: Option<String>,
    author_pubkey: Option<String>,
) -> AuthorContextFeedView {
    let Some(event_id_value) = event_id.clone() else {
        return default_author_context_feed_view(owner, event_id, author_pubkey);
    };
    let Some(author_pubkey_value) = author_pubkey.clone() else {
        return default_author_context_feed_view(owner, event_id, author_pubkey);
    };
    let selected = match selected_relays(host).await {
        StorageOutcome::Ok(relays) => relays,
        _ => Vec::new(),
    };
    let mut diagnostics = Vec::<AuthorContextFeedDiagnosticInput>::new();
    let cache = author_context_cache_state(
        host,
        &event_id_value,
        &author_pubkey_value,
        &mut diagnostics,
    )
    .await;
    build_view(
        owner,
        AuthorContextModelParts {
            event_id,
            author_pubkey,
            selected_relays: selected,
            window: cache.window,
            source_state: cache.source_state,
            anchor_created_at: cache.anchor_created_at,
            diagnostics,
        },
    )
}

fn build_view(owner: &str, parts: AuthorContextModelParts) -> AuthorContextFeedView {
    build_author_context_feed_view(AuthorContextFeedViewInput {
        owner: owner.to_owned(),
        event_id: parts.event_id,
        author_pubkey: parts.author_pubkey,
        source_state: parts.source_state,
        selected_relays: parts.selected_relays,
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
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
