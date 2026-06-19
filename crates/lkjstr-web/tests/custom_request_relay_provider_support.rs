#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_protocol::{KIND_TEXT_NOTE, NostrEvent};
use wasm_bindgen::prelude::JsValue;

pub(crate) struct WebSocketRestore;

impl Drop for WebSocketRestore {
    fn drop(&mut self) {
        let _ = restore_websocket();
    }
}

pub(crate) fn install_custom_request_websocket(
    event: &NostrEvent,
) -> Result<WebSocketRestore, JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrCustomRequestEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrCustomRequestFrames = [];
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            window.__lkjstrCustomRequestFrames.push(frame);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            const event = JSON.parse(window.__lkjstrCustomRequestEvent);
            setTimeout(() => {
              this.onmessage && this.onmessage({
                data: JSON.stringify(['EVENT', sub, event]),
              });
              this.onmessage && this.onmessage({
                data: JSON.stringify(['EOSE', sub]),
              });
            }, 0);
          }
          close() {
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| WebSocketRestore)
}

fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrCustomRequestEvent;
        delete window.__lkjstrCustomRequestFrames;
        "#,
    )
    .map(|_| ())
}

pub(crate) fn request_frame_count() -> usize {
    web_sys::window()
        .and_then(|window| {
            js_sys::Reflect::get(&window, &JsValue::from_str("__lkjstrCustomRequestFrames")).ok()
        })
        .map(|value| js_sys::Array::from(&value).length() as usize)
        .unwrap_or_default()
}

pub(crate) fn first_request_filter_limit() -> Result<Option<u64>, JsValue> {
    let value = js_sys::eval(
        r#"
        (() => {
          const frames = window.__lkjstrCustomRequestFrames || [];
          const req = frames.find((frame) => frame && frame[0] === 'REQ');
          return req && req[2] ? req[2].limit ?? null : null;
        })()
        "#,
    )?;
    Ok(value.as_f64().map(|limit| limit as u64))
}

pub(crate) fn custom_request_event() -> NostrEvent {
    NostrEvent {
        id: id(15),
        pubkey: pubkey("a"),
        created_at: 15,
        kind: KIND_TEXT_NOTE,
        tags: Vec::new(),
        content: "custom request relay event".to_owned(),
        sig: "c".repeat(128),
    }
}

fn pubkey(value: &str) -> String {
    value.repeat(64)
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
