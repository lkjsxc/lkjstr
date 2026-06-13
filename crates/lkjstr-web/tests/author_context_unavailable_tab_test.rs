#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{reset_shells, wait_for_text};
use lkjstr_app::{
    AuthorContextFeedSourceState, AuthorContextFeedViewInput, FeedFragmentConfig, StartupInput,
    build_author_context_feed_view, default_recovery_ids, empty_feed_window,
};
use lkjstr_domain::{NewTabIds, TabKind, create_workspace, open_configured_tab};
use lkjstr_relays::DemandVisibility;
use lkjstr_ui::AuthorContextFeedProvider;
use lkjstr_web::{
    mount_rust_workspace_shell_with_author_context_feed_provider,
    mount_rust_workspace_shell_with_startup,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_author_context_tab_renders_unavailable_states() -> Result<(), JsValue> {
    assert_default_state(
        "author-context-missing-event",
        None,
        Some(pubkey()),
        "Author Context event unavailable.",
        "Author Context needs a target event before loading nearby author posts.",
    )
    .await?;
    assert_default_state(
        "author-context-missing-author",
        Some(id(7)),
        None,
        "Author Context author unavailable.",
        "Author Context needs the target event author before loading nearby posts.",
    )
    .await?;
    assert_default_state(
        "author-context-no-route",
        Some(id(7)),
        Some(pubkey()),
        "Author Context needs a relay.",
        "Author Context needs at least one enabled read relay or author route.",
    )
    .await?;
    assert_anchor_time_state().await
}

async fn assert_default_state(
    tab_id: &str,
    event_id: Option<String>,
    pubkey: Option<String>,
    status: &str,
    detail: &str,
) -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_startup(startup(tab_id, event_id, pubkey));
    wait_for_text(status).await?;
    wait_for_text(detail).await
}

async fn assert_anchor_time_state() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_author_context_feed_provider(
        startup("author-context-missing-anchor", Some(id(7)), Some(pubkey())),
        anchor_time_provider(),
    );
    wait_for_text("Author Context partial.").await?;
    wait_for_text("Author Context needs the anchor event timestamp before nearby author reads.")
        .await
}

fn anchor_time_provider() -> AuthorContextFeedProvider {
    AuthorContextFeedProvider::new(|request| {
        request.complete(build_author_context_feed_view(AuthorContextFeedViewInput {
            owner: request.owner.clone(),
            event_id: request.event_id.clone(),
            author_pubkey: request.author_pubkey.clone(),
            source_state: AuthorContextFeedSourceState::Pending,
            selected_relays: vec!["wss://selected.example".to_owned()],
            disabled_relays: Vec::new(),
            author_routes: Vec::new(),
            visibility: DemandVisibility::Visible,
            anchor_created_at: None,
            now_sec: 1_700_000_030,
            page_size: 30,
            window: empty_feed_window(1, 180),
            width_px: 680,
            font_scale: 1.0,
            geometry_models: Vec::new(),
            fragment_config: FeedFragmentConfig::default(),
            diagnostics: Vec::new(),
        }));
    })
}

fn startup(tab_id: &str, event_id: Option<String>, pubkey: Option<String>) -> StartupInput {
    let ids = default_recovery_ids("main");
    let mut config = BTreeMap::new();
    if let Some(event_id) = event_id {
        config.insert("eventId".to_owned(), event_id);
    }
    if let Some(pubkey) = pubkey {
        config.insert("pubkey".to_owned(), pubkey);
    }
    let workspace = open_configured_tab(
        create_workspace(ids.clone(), 1),
        Some(&ids.pane_id),
        TabKind::AuthorContext,
        NewTabIds {
            tab_id: tab_id.to_owned(),
        },
        config,
        2,
    );
    StartupInput {
        stored_workspace: Some(workspace),
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: ids,
        now: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
