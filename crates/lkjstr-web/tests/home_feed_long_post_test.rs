#![cfg(target_arch = "wasm32")]

use lkjstr_app::{
    FeedFragmentConfig, FeedWindowEvidence, FeedWindowFlags, HomeFeedSourceState,
    HomeFeedViewInput, HomeFollowState, ProtectedAccountAvailability, RowGeometryModel,
    StartupInput, build_home_feed_view, default_recovery_ids, empty_feed_window,
    reduce_feed_window,
};
use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use lkjstr_relays::{DemandVisibility, ProgressiveEvent};
use lkjstr_web::mount_rust_workspace_shell_with_home_feed;
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_home_long_post_fragments_render_inside_scroll_owner() -> Result<(), JsValue> {
    reset_shells()?;
    mount_rust_workspace_shell_with_home_feed(startup(), home_model());
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;
    wait_for_text("longposttokenlongposttoken").await?;

    let owner = required_element(".home-list-scroll")?;
    let owner_html = owner
        .dyn_ref::<web_sys::HtmlElement>()
        .ok_or_else(|| js_error("Home scroll owner is not an HtmlElement"))?;
    if owner_html.scroll_width() > owner_html.client_width() + 1 {
        return Err(js_error("long Home post created horizontal overflow"));
    }
    let row = owner
        .query_selector(".lkjstr-feed-row.event")?
        .ok_or_else(|| js_error("missing long Home post row"))?;
    if row.get_attribute("data-event-id").as_deref() != Some(id(1).as_str()) {
        return Err(js_error("long-post row changed event identity"));
    }
    let paragraphs = row.query_selector_all("p")?;
    if paragraphs.length() < 3 {
        return Err(js_error("long Home post did not render segmented text"));
    }
    for index in 0..paragraphs.length() {
        let paragraph = paragraphs
            .item(index)
            .ok_or_else(|| js_error("missing long-post paragraph"))?
            .dyn_into::<web_sys::Element>()?;
        let length = paragraph.text_content().unwrap_or_default().chars().count();
        if length > 90 {
            return Err(js_error("long-post paragraph exceeded segment cap"));
        }
    }
    if !owner
        .text_content()
        .unwrap_or_default()
        .contains("longpost-tail")
    {
        return Err(js_error("long-post tail rendered outside scroll owner"));
    }
    Ok(())
}

fn home_model() -> lkjstr_app::HomeFeedView {
    build_home_feed_view(HomeFeedViewInput {
        owner: "home-long-post".to_owned(),
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
            id: id(1),
            pubkey: pubkey("b"),
            created_at: 1_700_000_001,
            kind: KIND_TEXT_NOTE,
            tags: Vec::new(),
            content: format!("{}longpost-tail", "longposttoken".repeat(28)),
            sig: "b".repeat(128),
        },
    }
}

fn fragment_config() -> FeedFragmentConfig {
    FeedFragmentConfig {
        text_segment_target_chars: 48,
        text_segment_max_chars: 72,
        oversize_estimated_height_px: 1,
        ..FeedFragmentConfig::default()
    }
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!("timed out waiting for text: {text}")))
}

fn click(selector: &str) -> Result<(), JsValue> {
    required_element(selector)?
        .dyn_into::<web_sys::HtmlElement>()?
        .click();
    Ok(())
}

async fn next_task() -> Result<(), JsValue> {
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        let Some(window) = web_sys::window() else {
            let _result = reject.call1(&JsValue::NULL, &js_error("missing window"));
            return;
        };
        let callback = Closure::once_into_js(move || {
            let _result = resolve.call0(&JsValue::NULL);
        });
        if let Err(error) = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(callback.unchecked_ref(), 0)
        {
            let _result = reject.call1(&JsValue::NULL, &error);
        }
    });
    JsFuture::from(promise).await.map(|_| ())
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    document()?
        .body()
        .and_then(|body| body.text_content())
        .ok_or_else(|| js_error("missing document text"))
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
