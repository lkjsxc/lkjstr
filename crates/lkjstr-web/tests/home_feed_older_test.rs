#![cfg(target_arch = "wasm32")]
mod accounts_selector_test_support;
mod home_feed_older_support;
use accounts_selector_test_support::{click, next_task, wait_for_text};
use home_feed_older_support::{check, install, restore};
use lkjstr_ui::{HomeIslandActions, mount_home_island};
use lkjstr_web::home_feed_provider_test_api::provider_with_page_account;
use wasm_bindgen::{JsCast, prelude::JsValue};
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};
wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn explicit_history_preserves_scope_ties_and_cleanup() -> Result<(), JsValue> {
    let document = web_sys::window()
        .and_then(|w| w.document())
        .ok_or("document")?;
    let parent = document
        .create_element("div")?
        .dyn_into::<web_sys::HtmlElement>()?;
    document.body().ok_or("body")?.append_child(&parent)?;
    install()?;
    let provider = provider_with_page_account(
        "home-older-proof".to_owned(),
        "http://%".to_owned(),
        "a".repeat(64),
    );
    let unmount = mount_home_island(
        parent.clone(),
        "history-owner".to_owned(),
        Some("a".repeat(64)),
        provider,
        HomeIslandActions {
            open_profile: None,
            open_thread: None,
            open_author_context: None,
            copy_event_id: None,
        },
    );
    let mut cleanup = Cleanup {
        unmount: Box::new(unmount),
        parent,
    };
    wait_for_text("history initial note").await?;
    wait_for_text("Load older").await?;
    check(
        "__homeHistory.requests.length > 0 && __homeHistory.requests.every(r => r.filters.every(f => f.limit === Math.min(30, Math.max(1, Math.floor(179 / __homeHistory.requests.length))) && f.since === undefined && f.until > 100 && f.authors.join(',') === ['a'.repeat(64), 'b'.repeat(64)].join(',')))",
    )?;
    js_sys::eval("__homeHistory.initialCount = __homeHistory.requests.length")?;
    click("[data-testid='home-load-older']")?;
    click("[data-testid='home-load-older']")?;
    wait_pending().await?;
    check("document.querySelector('[data-testid=home-load-older]').disabled")?;
    check("__homeHistory.requests.length === __homeHistory.initialCount * 2")?;
    check(
        "__homeHistory.requests.slice(__homeHistory.initialCount).every(r => __homeHistory.requests.slice(0, __homeHistory.initialCount).some(initial => initial.url === r.url) && r.filters.every(f => f.until === 100 && f.since === undefined && f.limit === Math.floor(179 / __homeHistory.initialCount) && f.authors.join(',') === ['a'.repeat(64), 'b'.repeat(64)].join(',')))",
    )?;
    js_sys::eval("__homeHistory.flush(false)")?;
    wait_for_text("history older note").await?;
    check(
        "document.body.textContent.includes('history tied note') && !document.body.textContent.includes('rejected ')",
    )?;
    check(
        "document.querySelectorAll('[data-row-id=\"event:' + '3'.repeat(64) + '\"]').length === 1",
    )?;
    check("!document.querySelector('[data-testid=home-load-older]').disabled")?;
    click("[data-testid='home-load-older']")?;
    wait_pending().await?;
    check(
        "__homeHistory.pending.length > 0 && __homeHistory.requests.slice(-__homeHistory.initialCount).every(r => r.filters.every(f => f.until === 99))",
    )?;
    js_sys::eval("__homeHistory.flush(true)")?;
    wait_for_text("older history remains unproven").await?;
    check("document.body.textContent.includes('history older note')")?;
    click("[data-testid='home-load-older']")?;
    wait_pending().await?;
    (cleanup.unmount)();
    next_task().await?;
    check("__homeHistory.sockets.every(socket => socket.readyState === 3)")?;
    js_sys::eval("__homeHistory.flush(false)")?;
    next_task().await?;
    assert!(cleanup.parent.text_content().unwrap_or_default().is_empty());
    Ok(())
}

#[wasm_bindgen_test(async)]
async fn relay_frontier_prevents_sparse_tail_skips_and_pins_failed_or_tied_reads()
-> Result<(), JsValue> {
    let document = web_sys::window()
        .and_then(|w| w.document())
        .ok_or("document")?;
    let parent = document
        .create_element("div")?
        .dyn_into::<web_sys::HtmlElement>()?;
    document.body().ok_or("body")?.append_child(&parent)?;
    install()?;
    js_sys::eval("__homeHistory.sparse = true")?;
    let unmount = mount_home_island(
        parent.clone(),
        "gap-owner".to_owned(),
        Some("a".repeat(64)),
        provider_with_page_account(
            "home-gap-proof".to_owned(),
            "http://%".to_owned(),
            "a".repeat(64),
        ),
        HomeIslandActions {
            open_profile: None,
            open_thread: None,
            open_author_context: None,
            copy_event_id: None,
        },
    );
    let mut cleanup = Cleanup {
        unmount: Box::new(unmount),
        parent,
    };
    wait_for_text("history initial note").await?;
    wait_for_text("sparse initial tail").await?;
    wait_for_text("Load older").await?;
    js_sys::eval("__homeHistory.initialCount = __homeHistory.requests.length")?;
    check("__homeHistory.initialCount > 1")?;
    request_until(100).await?;
    check(
        "__homeHistory.requests.slice(-__homeHistory.initialCount).flatMap(r => r.filters).reduce((n, f) => n + f.limit, 0) <= 179",
    )?;
    js_sys::eval("__homeHistory.flushGap()")?;
    wait_for_text("dense history gap").await?;
    request_until(90).await?;
    js_sys::eval("__homeHistory.flushGap('fail')")?;
    wait_for_text("dense failed-read row").await?;
    wait_for_text("older history remains unproven").await?;
    request_until(90).await?;
    js_sys::eval("__homeHistory.flushGap('tied')")?;
    wait_for_text("sparse tied-boundary row").await?;
    wait_for_text("older history remains unproven").await?;
    request_until(90).await?;
    (cleanup.unmount)();
    next_task().await?;
    check("__homeHistory.sockets.every(socket => socket.readyState === 3)")?;
    js_sys::eval("__homeHistory.flushGap()")?;
    next_task().await?;
    assert!(cleanup.parent.text_content().unwrap_or_default().is_empty());
    Ok(())
}

async fn request_until(until: u64) -> Result<(), JsValue> {
    next_task().await?;
    check("!document.querySelector('[data-testid=home-load-older]').disabled")?;
    click("[data-testid='home-load-older']")?;
    wait_pending().await?;
    check(&format!(
        "__homeHistory.requests.slice(-__homeHistory.initialCount).every(r => r.filters.every(f => f.until === {until}))"
    ))
}

async fn wait_pending() -> Result<(), JsValue> {
    for _ in 0..500 {
        next_task().await?;
        if js_sys::eval("__homeHistory.pending.length === __homeHistory.initialCount")?.as_bool()
            == Some(true)
        {
            return Ok(());
        }
    }
    Err(js_sys::Error::new("bounded wait for Home history requests").into())
}

struct Cleanup {
    unmount: Box<dyn FnMut()>,
    parent: web_sys::HtmlElement,
}
impl Drop for Cleanup {
    fn drop(&mut self) {
        (self.unmount)();
        self.parent.remove();
        restore();
    }
}
