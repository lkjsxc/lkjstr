#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, RowGeometryModel, StartupInput, build_home_feed_view,
    default_recovery_ids, empty_feed_window, reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_multiline_post_preserves_order_and_scrolls_to_tail() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("line-000").await?;
    wait_for_text("line-320").await?;

    let owner = required_element(".home-list-scroll")?;
    let section = required_element(".lkjstr-home-feed")?;
    let owners = section.query_selector_all("[data-scroll-owner]")?;
    if owners.length() != 1 {
        return Err(js_error(
            "Home multiline feed did not keep one scroll owner",
        ));
    }
    let row = owner
        .query_selector(".lkjstr-feed-row.event")?
        .ok_or_else(|| js_error("missing multiline Home post row"))?;
    if row.get_attribute("data-event-id").as_deref() != Some(id(7).as_str()) {
        return Err(js_error("multiline row changed event identity"));
    }
    let paragraphs = row.query_selector_all("p")?;
    if paragraphs.length() < 10 {
        return Err(js_error(
            "multiline Home post did not render segmented text",
        ));
    }
    if paragraph_text(&paragraphs)? != multiline_content() {
        return Err(js_error("multiline Home segments changed order or content"));
    }
    assert_scrolls_to_tail(owner).await
}

async fn assert_scrolls_to_tail(owner: web_sys::Element) -> Result<(), JsValue> {
    let owner = owner.dyn_into::<web_sys::HtmlElement>()?;
    owner.set_attribute("style", "display:block;height:80px;overflow-y:auto;")?;
    next_task().await?;
    if owner.scroll_height() <= owner.client_height() {
        return Err(js_error(
            "multiline Home post did not make the owner scrollable",
        ));
    }
    owner.set_scroll_top(0);
    let top = owner.scroll_top();
    owner.set_scroll_top(owner.scroll_height());
    next_task().await?;
    if owner.scroll_top() <= top {
        return Err(js_error(
            "multiline Home scroll owner did not move toward tail",
        ));
    }
    Ok(())
}

fn paragraph_text(paragraphs: &web_sys::NodeList) -> Result<String, JsValue> {
    let mut text = String::new();
    for index in 0..paragraphs.length() {
        let paragraph = paragraphs
            .item(index)
            .ok_or_else(|| js_error("missing multiline paragraph"))?
            .dyn_into::<web_sys::Element>()?;
        text.push_str(&paragraph.text_content().unwrap_or_default());
    }
    Ok(text)
}

fn home_model() -> lkjstr_app::HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "home-line-breaks".to_owned(),
        active_pubkey: Some(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::CacheComplete,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_030,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 240),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![progressive()],
                flags: FeedWindowFlags::default(),
            },
        ),
        width_px: 360,
        font_scale: 1.0,
        geometry_models: Vec::<RowGeometryModel>::new(),
        fragment_config: fragment_config(),
        diagnostics: Vec::new(),
    })
}

fn progressive() -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(7),
            pubkey: pubkey("b"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: multiline_content(),
            sig: "c".repeat(128),
        },
    }
}

fn multiline_content() -> String {
    (0..=320)
        .map(|index| format!("line-{index:03}"))
        .collect::<Vec<_>>()
        .join("\n")
}

fn fragment_config() -> FeedFragmentConfig {
    FeedFragmentConfig {
        text_segment_target_chars: 80,
        text_segment_max_chars: 120,
        oversize_estimated_height_px: 1,
        ..FeedFragmentConfig::default()
    }
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn startup() -> StartupInput {
    StartupInput {
        stored_workspace: None,
        storage_available: true,
        tab_snapshots: Vec::new(),
        recovery_ids: default_recovery_ids("main"),
        now: 0,
    }
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
