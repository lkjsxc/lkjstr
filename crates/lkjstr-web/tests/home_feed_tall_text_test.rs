#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{click, next_task, reset_shells, wait_for_text};
use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, ProtectedAccountAvailability, RowGeometryModel,
    StartupInput, build_home_feed_view, default_recovery_ids, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_tall_text_note_scrolls_from_above_to_below() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("above tall note").await?;
    wait_for_text("tall-text-tail").await?;
    wait_for_text("below tall note").await?;

    let owner = required_element(".home-list-scroll")?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("Home scroll owner is not an HtmlElement"))?;
    let section = required_element(".lkjstr-home-feed")?;
    if section.query_selector_all("[data-scroll-owner]")?.length() != 1 {
        return Err(js_error("Home tall-text feed lost its scroll owner"));
    }
    let tall = row_html(20)?;
    assert_text_order(&owner.text_content().unwrap_or_default())?;
    let paragraphs = tall.query_selector_all("p")?;
    if paragraphs.length() < 60 {
        return Err(js_error("tall Home note did not render many segments"));
    }
    if paragraph_text(&paragraphs)? != tall_content() {
        return Err(js_error("tall Home note segments changed content"));
    }
    assert_scroll_reaches_bottom(&owner).await
}

async fn assert_scroll_reaches_bottom(owner: &web_sys::HtmlElement) -> Result<(), JsValue> {
    owner.set_attribute("style", "display:block;height:96px;overflow-y:auto;")?;
    next_task().await?;
    if owner.scroll_height() <= owner.client_height() {
        return Err(js_error("tall Home note did not make the owner scrollable"));
    }
    owner.set_scroll_top(0);
    let top = owner.scroll_top();
    owner.set_scroll_top(owner.scroll_height());
    next_task().await?;
    if owner.scroll_top() <= top {
        return Err(js_error("Home owner did not scroll through tall note"));
    }
    if owner.scroll_top() + owner.client_height() + 1 < owner.scroll_height() {
        return Err(js_error("Home owner did not reach its scroll bottom"));
    }
    Ok(())
}

fn assert_text_order(text: &str) -> Result<(), JsValue> {
    let before = pos(text, "above tall note")?;
    let start = pos(text, "tall-text-start")?;
    let tail = pos(text, "tall-text-tail")?;
    let after = pos(text, "below tall note")?;
    if before < start && start < tail && tail < after {
        return Ok(());
    }
    Err(js_error("tall Home note did not keep above-to-below order"))
}

fn pos(text: &str, needle: &str) -> Result<usize, JsValue> {
    text.find(needle)
        .ok_or_else(|| js_error("missing tall-text marker"))
}

fn row_html(value: u64) -> Result<web_sys::HtmlElement, JsValue> {
    required_element(&format!(
        ".lkjstr-feed-row.event[data-event-id='{}']",
        id(value)
    ))?
    .dyn_into::<web_sys::HtmlElement>()
    .map_err(|_| js_error("Home feed row is not an HtmlElement"))
}

fn paragraph_text(paragraphs: &web_sys::NodeList) -> Result<String, JsValue> {
    let mut text = String::new();
    for index in 0..paragraphs.length() {
        let paragraph = paragraphs
            .item(index)
            .ok_or_else(|| js_error("missing tall-text paragraph"))?
            .dyn_into::<web_sys::Element>()?;
        text.push_str(&paragraph.text_content().unwrap_or_default());
    }
    Ok(text)
}

fn home_model() -> lkjstr_app::HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "home-tall-text".to_owned(),
        account: ProtectedAccountAvailability::selected(pubkey("a")),
        follow_state: HomeFollowState::Loaded {
            follow_pubkeys: vec![pubkey("b")],
        },
        source_state: HomeFeedSourceState::CacheComplete,
        selected_relays: vec!["wss://selected.example".to_owned()],
        disabled_relays: Vec::new(),
        author_routes: Vec::new(),
        visibility: DemandVisibility::Visible,
        since: Some(1_700_000_000),
        now_sec: 1_700_000_040,
        page_size: 30,
        window: reduce_feed_window(
            empty_feed_window(1, 240),
            FeedWindowEvidence::Events {
                generation: 1,
                events: vec![
                    event(30, "above tall note"),
                    event(20, &tall_content()),
                    event(10, "below tall note"),
                ],
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

fn event(value: u64, content: &str) -> ProgressiveEvent {
    ProgressiveEvent {
        relays: vec!["wss://selected.example".to_owned()],
        sub_id: "home".to_owned(),
        event: NostrEvent {
            id: id(value),
            pubkey: pubkey("b"),
            created_at: 1_700_000_000 + value,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: content.to_owned(),
            sig: "d".repeat(128),
        },
    }
}

fn tall_content() -> String {
    format!(
        "tall-text-start {}tall-text-tail",
        "talltextword ".repeat(1_700)
    )
}

fn fragment_config() -> FeedFragmentConfig {
    FeedFragmentConfig {
        text_segment_target_chars: 220,
        text_segment_max_chars: 300,
        oversize_estimated_height_px: 1,
        ..FeedFragmentConfig::default()
    }
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    let document = web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))?;
    document
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
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
