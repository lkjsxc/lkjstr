#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use std::collections::BTreeMap;

use accounts_selector_test_support::{reset_shells, wait_for_text};
use lkjstr_app::{
    AuthorContextFeedSourceState, AuthorContextFeedView, AuthorContextFeedViewInput,
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, RowGeometryModel, StartupInput,
    build_author_context_feed_view, default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_domain::{NewTabIds, TabKind, create_workspace, open_configured_tab};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_ui::AuthorContextFeedProvider;
use lkjstr_web::mount_rust_workspace_shell_with_author_context_feed_provider;
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_author_context_tab_renders_provider_feed_rows() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_author_context_feed_provider(startup(), provider());

    wait_for_text("Author Context ready.").await?;
    wait_for_text("real author context event").await?;
    wait_for_text("Cached rows").await?;
    assert!(!document_text()?.contains("The Rust Author Context body is not converted yet."));
    Ok(())
}

fn provider() -> AuthorContextFeedProvider {
    AuthorContextFeedProvider::new(|request| {
        request.complete(model(
            &request.owner,
            request.event_id.clone(),
            request.author_pubkey.clone(),
        ));
    })
}

fn model(
    owner: &str,
    event_id: Option<String>,
    author_pubkey: Option<String>,
) -> AuthorContextFeedView {
    build_author_context_feed_view(AuthorContextFeedViewInput {
        owner: owner.to_owned(),
        event_id,
        author_pubkey,
        source_state: AuthorContextFeedSourceState::CacheComplete,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        anchor_created_at: Some(1_700_000_010),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: window(),
        width_px: 680,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: FeedFragmentConfig::default(),
        diagnostics: Vec::new(),
    })
}

fn window() -> lkjstr_app::FeedWindowState {
    reduce_feed_window(
        empty_feed_window(1, 180),
        FeedWindowEvidence::Events {
            generation: 1,
            events: vec![progressive()],
            flags: FeedWindowFlags::default(),
        },
    )
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "author-context".to_owned(),
        event: NostrEvent {
            id: id(9),
            pubkey: pubkey(),
            created_at: 1_700_000_009,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: "real author context event".to_owned(),
            sig: "b".repeat(128),
        },
    }
}

fn startup() -> StartupInput {
    let ids = default_recovery_ids("main");
    let mut config = BTreeMap::new();
    config.insert("eventId".to_owned(), id(7));
    config.insert("pubkey".to_owned(), pubkey());
    let workspace = open_configured_tab(
        create_workspace(ids.clone(), 1),
        Some(&ids.pane_id),
        TabKind::AuthorContext,
        NewTabIds {
            tab_id: "author-context-provider".to_owned(),
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

fn document_text() -> Result<String, JsValue> {
    Ok(web_sys::window()
        .and_then(|window| window.document())
        .and_then(|document| document.body())
        .and_then(|body| body.text_content())
        .unwrap_or_default())
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey() -> String {
    "a".repeat(64)
}
