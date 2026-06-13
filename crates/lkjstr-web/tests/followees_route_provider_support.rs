#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_protocol::NostrEvent;
use wasm_bindgen::prelude::JsValue;

pub(crate) fn install_partial_followees_websocket(
    event: &NostrEvent,
    empty_relay_url: &str,
) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrFolloweesFollowEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrFolloweesEmptyRelay"),
        &JsValue::from_str(empty_relay_url),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrFolloweesSocketUrls = [];
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrFolloweesSocketUrls.push(url);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            const event = JSON.parse(window.__lkjstrFolloweesFollowEvent);
            if (this.url === window.__lkjstrFolloweesEmptyRelay) {
              setTimeout(() => this.onmessage && this.onmessage({
                data: JSON.stringify(['EOSE', sub]),
              }), 0);
              return;
            }
            setTimeout(() => {
              this.onmessage && this.onmessage({
                data: JSON.stringify(['EVENT', sub, event]),
              });
              this.onmessage && this.onmessage({
                data: JSON.stringify(['EOSE', sub]),
              });
            }, 5);
          }
          close() {
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

pub(crate) fn followees_socket_urls() -> Vec<String> {
    web_sys::window()
        .and_then(|window| {
            js_sys::Reflect::get(&window, &JsValue::from_str("__lkjstrFolloweesSocketUrls")).ok()
        })
        .map(|value| {
            js_sys::Array::from(&value)
                .iter()
                .filter_map(|item| item.as_string())
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrFolloweesFollowEvent;
        delete window.__lkjstrFolloweesEmptyRelay;
        delete window.__lkjstrFolloweesSocketUrls;
        "#,
    )
    .map(|_| ())
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
