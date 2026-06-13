#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_protocol::NostrEvent;
use wasm_bindgen::prelude::JsValue;

pub(crate) fn install_delayed_user_timeline_websocket(event: &NostrEvent) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrUserTimelineFollowEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrUserTimelineSockets = [];
        window.__lkjstrUserTimelineReqCount = 0;
        window.__lkjstrUserTimelineCloseCount = 0;
        window.__lkjstrTriggerUserTimelineEvent = () => {
          const event = JSON.parse(window.__lkjstrUserTimelineFollowEvent);
          for (const socket of window.__lkjstrUserTimelineSockets || []) {
            if (!socket.sub) continue;
            socket.onmessage && socket.onmessage({
              data: JSON.stringify(['EVENT', socket.sub, event]),
            });
          }
        };
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrUserTimelineSockets.push(this);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] === 'REQ') {
              this.sub = frame[1];
              window.__lkjstrUserTimelineReqCount += 1;
            }
          }
          close() {
            window.__lkjstrUserTimelineCloseCount += 1;
            this.onclose && this.onclose({ type: 'close' });
          }
        };
        "#,
    )
    .map(|_| ())
}

pub(crate) fn trigger_delayed_user_timeline_event() -> Result<(), JsValue> {
    js_sys::eval(
        "window.__lkjstrTriggerUserTimelineEvent && window.__lkjstrTriggerUserTimelineEvent();",
    )
    .map(|_| ())
}

pub(crate) fn delayed_user_timeline_request_count() -> u32 {
    counter("__lkjstrUserTimelineReqCount")
}

pub(crate) fn delayed_user_timeline_close_count() -> u32 {
    counter("__lkjstrUserTimelineCloseCount")
}

pub(crate) fn restore_delayed_user_timeline_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrUserTimelineFollowEvent;
        delete window.__lkjstrUserTimelineSockets;
        delete window.__lkjstrUserTimelineReqCount;
        delete window.__lkjstrUserTimelineCloseCount;
        delete window.__lkjstrTriggerUserTimelineEvent;
        "#,
    )
    .map(|_| ())
}

fn counter(name: &str) -> u32 {
    web_sys::window()
        .and_then(|window| js_sys::Reflect::get(&window, &JsValue::from_str(name)).ok())
        .and_then(|value| value.as_f64())
        .map_or(0, |value| value as u32)
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
