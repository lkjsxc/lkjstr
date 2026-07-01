#![cfg(target_arch = "wasm32")]

mod accounts_selector_test_support;

use accounts_selector_test_support::{click, reset_shells, wait_for_text};
use lkjstr_app::{StartupInput, default_recovery_ids};
use lkjstr_protocol::{KIND_FOLLOW_LIST, KIND_TEXT_NOTE, NostrEvent, NostrTag};
use lkjstr_web::{
    home_feed_provider_test_api::provider_with_page_account,
    mount_rust_workspace_shell_with_home_feed_provider,
};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_test::{wasm_bindgen_test, wasm_bindgen_test_configure};

wasm_bindgen_test_configure!(run_in_browser);

#[wasm_bindgen_test(async)]
async fn degraded_cache_unavailable_home_recovers_real_relay_note() -> Result<(), JsValue> {
    reset_shells()?;
    install_home_websocket(&follow_event(), &note_event())?;
    let _restore = WebSocketRestore;
    let provider = provider_with_page_account(
        "home-cache-unavailable".to_owned(),
        "http://%".to_owned(),
        pubkey("a"),
    );

    mount_rust_workspace_shell_with_home_feed_provider(startup(), provider);
    wait_for_text("Welcome").await?;
    click("[data-testid='welcome-open-timeline']")?;

    wait_for_text("Follow list cache unavailable").await?;
    wait_for_text("relay recovered home note").await
}

struct WebSocketRestore;

impl Drop for WebSocketRestore {
    fn drop(&mut self) {
        let _ = restore_websocket();
    }
}

fn install_home_websocket(follow: &NostrEvent, note: &NostrEvent) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrHomeFollowEvent"),
        &JsValue::from_str(&event_json(follow)?),
    )?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrHomeNoteEvent"),
        &JsValue::from_str(&event_json(note)?),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrHomeReqCount = 0;
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            this.readyState = 0;
            setTimeout(() => {
              this.readyState = 1;
              this.onopen && this.onopen({ type: 'open' });
            }, 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            const filters = frame.slice(2);
            const kinds = filters.flatMap((filter) => filter.kinds || []);
            const event = kinds.includes(3)
              ? JSON.parse(window.__lkjstrHomeFollowEvent)
              : JSON.parse(window.__lkjstrHomeNoteEvent);
            window.__lkjstrHomeReqCount += 1;
            setTimeout(() => {
              this.onmessage && this.onmessage({ data: JSON.stringify(['EVENT', sub, event]) });
              this.onmessage && this.onmessage({ data: JSON.stringify(['EOSE', sub]) });
            }, 0);
          }
          close() {
            this.readyState = 2;
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrHomeFollowEvent;
        delete window.__lkjstrHomeNoteEvent;
        delete window.__lkjstrHomeReqCount;
        "#,
    )
    .map(|_| ())
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

fn follow_event() -> NostrEvent {
    event(
        "1",
        &pubkey("a"),
        KIND_FOLLOW_LIST,
        vec![vec![
            "p".to_owned(),
            pubkey("b"),
            "".to_owned(),
            "".to_owned(),
        ]],
        "",
    )
}

fn note_event() -> NostrEvent {
    event(
        "2",
        &pubkey("b"),
        KIND_TEXT_NOTE,
        Vec::new(),
        "relay recovered home note",
    )
}

fn event(
    id_prefix: &str,
    pubkey: &str,
    kind: u64,
    tags: Vec<NostrTag>,
    content: &str,
) -> NostrEvent {
    NostrEvent {
        id: id_prefix.repeat(64),
        pubkey: pubkey.to_owned(),
        created_at: 1_700_000_000 + id_prefix.parse::<u64>().unwrap_or_default(),
        kind,
        tags,
        content: content.to_owned(),
        sig: "f".repeat(128),
    }
}

fn event_json(event: &NostrEvent) -> Result<String, JsValue> {
    serde_json::to_string(event).map_err(|_| js_error("event json failed"))
}

fn pubkey(prefix: &str) -> String {
    prefix.repeat(64)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
