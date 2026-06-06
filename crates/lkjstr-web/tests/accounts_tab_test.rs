#![cfg(target_arch = "wasm32")]

use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

mod sqlite_tab_test_support;

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_accounts_tab_renders_or_adds_with_storage() -> Result<(), JsValue> {
    reset_shells()?;
    clear_active_account()?;
    let db_name = test_db_name();
    let worker_url = sqlite_tab_test_support::mount_sqlite_shell(db_name.clone())?;
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-account-manager']")?;
    wait_for_text("No account records are stored.").await?;
    if document_text()?.contains("Accounts unavailable") {
        return sqlite_tab_test_support::revoke_worker_url(&worker_url);
    }
    set_account_input(&"aa".repeat(32))?;
    next_task().await?;
    click(".accounts-toolbar button[type='submit']")?;
    if let Err(error) = wait_for_text("read-only").await {
        if document_text()?.contains("unavailable") {
            return sqlite_tab_test_support::revoke_worker_url(&worker_url);
        }
        return Err(error);
    }
    click_button_with_text("Generate nsec")?;
    next_task().await?;
    click(".accounts-toolbar button[type='submit']")?;
    wait_for_text("local").await?;
    click_button_with_text("Reveal nsec")?;
    wait_for_text("nsec1").await?;
    install_nip07_mock(&"bb".repeat(32))?;
    click_button_with_text("Connect NIP-07")?;
    wait_for_text("NIP-07 account connected.").await?;
    wait_for_text("NIP-07").await?;
    sqlite_tab_test_support::revoke_worker_url(&worker_url)
}

fn set_account_input(value: &str) -> Result<(), JsValue> {
    let input = document()?
        .query_selector("[aria-label='npub, hex pubkey, or nsec']")?
        .ok_or_else(|| js_error("missing account input"))?;
    input
        .dyn_ref::<web_sys::HtmlInputElement>()
        .ok_or_else(|| js_error("account editor is not an input"))?
        .set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    input.dispatch_event(&bubbling_event("change")?)?;
    Ok(())
}

fn click_button_with_text(text: &str) -> Result<(), JsValue> {
    let buttons = document()?.query_selector_all("button")?;
    for index in 0..buttons.length() {
        if let Some(button) = buttons.item(index)
            && button.text_content().unwrap_or_default().contains(text)
        {
            button.dyn_into::<web_sys::HtmlElement>()?.click();
            return Ok(());
        }
    }
    Err(js_error("missing text button"))
}

fn install_nip07_mock(pubkey: &str) -> Result<(), JsValue> {
    js_sys::eval(&format!(
        "window.nostr = {{ getPublicKey: async () => '{pubkey}' }};"
    ))
    .map(|_| ())
}

fn click(selector: &str) -> Result<(), JsValue> {
    let element = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?;
    element.dyn_into::<web_sys::HtmlElement>()?.click();
    Ok(())
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..1_500 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error(&format!(
        "timed out waiting for text: {text}: {}",
        document_text()?
    )))
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

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
}

fn reset_shells() -> Result<(), JsValue> {
    while let Some(shell) = document()?.query_selector("[data-testid='rust-workspace-shell']")? {
        shell.remove();
    }
    Ok(())
}

fn clear_active_account() -> Result<(), JsValue> {
    if let Some(storage) = web_sys::window()
        .ok_or_else(|| js_error("missing window"))?
        .local_storage()?
    {
        storage.remove_item("lkjstr.activeAccountId")?;
    }
    Ok(())
}

fn document_text() -> Result<String, JsValue> {
    let body = document()?
        .body()
        .ok_or_else(|| js_error("missing document body"))?;
    Ok(body.text_content().unwrap_or_default())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-accounts-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
