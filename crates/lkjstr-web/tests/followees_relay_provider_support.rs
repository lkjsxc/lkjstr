#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_protocol::NostrEvent;
use wasm_bindgen::prelude::JsValue;

pub(crate) const SELECTED_RELAY: &str = "wss://selected.example";

pub(crate) fn install_followees_websocket(event: &NostrEvent) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrFolloweesFollowEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            const event = JSON.parse(window.__lkjstrFolloweesFollowEvent);
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
    .map(|_| ())
}

pub(crate) fn install_delayed_followees_websocket(event: &NostrEvent) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrFolloweesFollowEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrFolloweesSockets = [];
        window.__lkjstrFolloweesReqCount = 0;
        window.__lkjstrFolloweesCloseCount = 0;
        window.__lkjstrTriggerFolloweesEvent = () => {
          const event = JSON.parse(window.__lkjstrFolloweesFollowEvent);
          for (const socket of window.__lkjstrFolloweesSockets || []) {
            if (!socket.sub) continue;
            socket.onmessage && socket.onmessage({
              data: JSON.stringify(['EVENT', socket.sub, event]),
            });
          }
        };
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrFolloweesSockets.push(this);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] === 'REQ') {
              this.sub = frame[1];
              window.__lkjstrFolloweesReqCount += 1;
            }
          }
          close() {
            window.__lkjstrFolloweesCloseCount += 1;
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

pub(crate) fn install_empty_followees_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrFolloweesReqCount = 0;
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            window.__lkjstrFolloweesReqCount += 1;
            setTimeout(() => {
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
    .map(|_| ())
}

pub(crate) fn trigger_delayed_followees_event() -> Result<(), JsValue> {
    js_sys::eval("window.__lkjstrTriggerFolloweesEvent && window.__lkjstrTriggerFolloweesEvent();")
        .map(|_| ())
}

pub(crate) fn delayed_followees_request_count() -> u32 {
    counter("__lkjstrFolloweesReqCount")
}

pub(crate) fn delayed_followees_close_count() -> u32 {
    counter("__lkjstrFolloweesCloseCount")
}

pub(crate) fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrFolloweesFollowEvent;
        delete window.__lkjstrFolloweesSockets;
        delete window.__lkjstrFolloweesReqCount;
        delete window.__lkjstrFolloweesCloseCount;
        delete window.__lkjstrTriggerFolloweesEvent;
        "#,
    )
    .map(|_| ())
}

pub(crate) fn relay_set() -> RelaySet {
    RelaySet {
        id: "followees-relay-provider".to_owned(),
        name: "Followees Relay Provider".to_owned(),
        purpose: RelayPurpose::User,
        is_default: Some(true),
        seeded: false,
        relays: vec![RelayRecord {
            url: SELECTED_RELAY.to_owned(),
            label: "Selected".to_owned(),
            enabled: true,
            read: true,
            write: false,
            state: RelayConnectionState::Idle,
            last_error: None,
            last_connected_at: None,
            updated_at: 9,
            health: RelayHealth::default(),
        }],
        updated_at: 9,
    }
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}

fn counter(name: &str) -> u32 {
    web_sys::window()
        .and_then(|window| js_sys::Reflect::get(&window, &JsValue::from_str(name)).ok())
        .and_then(|value| value.as_f64())
        .map_or(0, |value| value as u32)
}
