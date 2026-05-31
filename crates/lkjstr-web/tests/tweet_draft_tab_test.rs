#![cfg(target_arch = "wasm32")]

use lkjstr_domain::create_tweet_draft;
use lkjstr_storage::StorageOutcome;
use wasm_bindgen::{JsCast, closure::Closure, prelude::JsValue};
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

use lkjstr_web::{indexed_db, mount_rust_workspace_shell_from_db};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn rust_tweet_tab_loads_legacy_and_persists_tab_draft() -> Result<(), JsValue> {
    reset_shells()?;
    let db_name = test_db_name();
    let mut legacy = create_tweet_draft("main", None, "legacy note", 1);
    legacy.sensitive = true;
    legacy.content_warning_reason = "legacy warning".to_owned();
    assert_ok(indexed_db::tweet_draft_store::tweet_draft_put(&db_name, &legacy).await)?;
    mount_rust_workspace_shell_from_db(db_name.clone());
    open_tweet_tab().await?;
    wait_for_textarea_value("[aria-label='Tweet content']", "legacy note").await?;
    set_textarea("[aria-label='Tweet content']", "edited rust draft")?;
    wait_for_draft_content(&db_name, "tab:rust-tweet-1", "edited rust draft").await?;
    set_input("[aria-label='Content warning reason']", "fresh warning")?;
    wait_for_warning(&db_name, "tab:rust-tweet-1", "fresh warning").await
}

async fn open_tweet_tab() -> Result<(), JsValue> {
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-tweet']")?;
    wait_for_text("Publishing waits for Rust signing").await
}

async fn wait_for_draft_content(db_name: &str, id: &str, content: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        match indexed_db::tweet_draft_store::tweet_draft_get(db_name, id).await {
            StorageOutcome::Ok(Some(row)) if row.content == content => return Ok(()),
            StorageOutcome::Ok(_) => {}
            outcome => return Err(outcome_error(outcome.problem())),
        }
    }
    Err(js_error("timed out waiting for Tweet draft content"))
}

async fn wait_for_warning(db_name: &str, id: &str, warning: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        match indexed_db::tweet_draft_store::tweet_draft_get(db_name, id).await {
            StorageOutcome::Ok(Some(row)) if row.content_warning_reason == warning => return Ok(()),
            StorageOutcome::Ok(_) => {}
            outcome => return Err(outcome_error(outcome.problem())),
        }
    }
    Err(js_error("timed out waiting for Tweet draft warning"))
}

async fn wait_for_textarea_value(selector: &str, expected: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if textarea(selector).is_ok_and(|item| item.value() == expected) {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for textarea value"))
}

async fn wait_for_text(text: &str) -> Result<(), JsValue> {
    for _ in 0..90 {
        next_task().await?;
        if document_text()?.contains(text) {
            return Ok(());
        }
    }
    Err(js_error("timed out waiting for text"))
}

fn set_textarea(selector: &str, value: &str) -> Result<(), JsValue> {
    let textarea = textarea(selector)?;
    textarea.set_value(value);
    textarea.dispatch_event(&bubbling_event("input")?)?;
    Ok(())
}

fn set_input(selector: &str, value: &str) -> Result<(), JsValue> {
    let input = input(selector)?;
    input.set_value(value);
    input.dispatch_event(&bubbling_event("input")?)?;
    Ok(())
}

fn textarea(selector: &str) -> Result<web_sys::HtmlTextAreaElement, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing textarea"))?
        .dyn_into::<web_sys::HtmlTextAreaElement>()
        .map_err(JsValue::from)
}

fn input(selector: &str) -> Result<web_sys::HtmlInputElement, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing input"))?
        .dyn_into::<web_sys::HtmlInputElement>()
        .map_err(JsValue::from)
}

fn click(selector: &str) -> Result<(), JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error("missing clickable element"))?
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

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn bubbling_event(name: &str) -> Result<web_sys::Event, JsValue> {
    let init = web_sys::EventInit::new();
    init.set_bubbles(true);
    web_sys::Event::new_with_event_init_dict(name, &init)
}

fn assert_ok(outcome: StorageOutcome<()>) -> Result<(), JsValue> {
    match outcome {
        StorageOutcome::Ok(()) => Ok(()),
        other => Err(outcome_error(other.problem())),
    }
}

fn outcome_error(problem: Option<&lkjstr_storage::StorageProblem>) -> JsValue {
    problem.map_or_else(
        || js_error("Tweet draft storage failed"),
        |item| js_error(item.reason),
    )
}

fn test_db_name() -> String {
    let random = (js_sys::Math::random() * 1_000_000.0) as u32;
    format!("lkjstr-tweet-draft-{}-{random}", js_sys::Date::now() as u64)
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
