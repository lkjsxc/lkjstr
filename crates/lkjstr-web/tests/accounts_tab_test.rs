#![cfg(target_arch = "wasm32")]

use lkjstr_domain::SignerType;
use lkjstr_storage::StorageOutcome;
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{indexed_db, mount_rust_workspace_shell_from_db};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_accounts_tab_adds_readonly_and_local_accounts() -> Result<(), JsValue> {
    reset_shells()?;
    clear_active_account()?;
    let db_name = test_db_name();
    mount_rust_workspace_shell_from_db(db_name.clone());
    wait_for_text("No account records are stored.").await?;
    set_account_input(&"aa".repeat(32))?;
    next_task().await?;
    click(".accounts-toolbar button[type='submit']")?;
    wait_for_account_count(&db_name, 1).await?;
    wait_for_text("read-only").await?;
    click_button_with_text("Generate nsec")?;
    next_task().await?;
    click(".accounts-toolbar button[type='submit']")?;
    wait_for_local_account(&db_name).await?;
    click_button_with_text("Reveal nsec")?;
    wait_for_text("nsec1").await?;
    Ok(())
}

async fn wait_for_account_count(db_name: &str, count: usize) -> Result<(), JsValue> {
    for _ in 0..70 {
        next_task().await?;
        match indexed_db::account_store::accounts_all(db_name).await {
            StorageOutcome::Ok(rows) if rows.len() == count => return Ok(()),
            StorageOutcome::Ok(_) => {}
            outcome => return Err(outcome_error(outcome.problem())),
        }
    }
    Err(js_error(&format!(
        "timed out waiting for account count: {}",
        document_text()?
    )))
}

async fn wait_for_local_account(db_name: &str) -> Result<(), JsValue> {
    for _ in 0..70 {
        next_task().await?;
        let rows = match indexed_db::account_store::accounts_all(db_name).await {
            StorageOutcome::Ok(rows) => rows,
            outcome => return Err(outcome_error(outcome.problem())),
        };
        if let Some(account) = rows.iter().find(|row| row.signer_type == SignerType::Local) {
            match indexed_db::local_secret_store::local_secret_get(db_name, &account.id).await {
                StorageOutcome::Ok(Some(_)) => return Ok(()),
                StorageOutcome::Ok(None) => {}
                outcome => return Err(outcome_error(outcome.problem())),
            }
        }
    }
    Err(js_error("timed out waiting for local account"))
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

fn click(selector: &str) -> Result<(), JsValue> {
    let element = document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?;
    element.dyn_into::<web_sys::HtmlElement>()?.click();
    Ok(())
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

fn outcome_error(problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    match problem {
        Some(problem) => js_error(problem.reason),
        None => js_error("account storage failed"),
    }
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-accounts-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
