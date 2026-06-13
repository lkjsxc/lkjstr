#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_protocol::NostrEvent;
use wasm_bindgen::prelude::JsValue;

pub(crate) const SELECTED_RELAY: &str = "wss://selected.example";

pub(crate) fn install_follow_list_websocket(event: &NostrEvent) -> Result<(), JsValue> {
    install_follow_list_websocket_with_empty_route(event, "")
}

pub(crate) fn install_partial_follow_list_websocket(
    event: &NostrEvent,
    empty_relay_url: &str,
) -> Result<(), JsValue> {
    install_follow_list_websocket_with_empty_route(event, empty_relay_url)
}

fn install_follow_list_websocket_with_empty_route(
    event: &NostrEvent,
    empty_relay_url: &str,
) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrUserTimelineFollowEvent"),
        &JsValue::from_str(
            &serde_json::to_string(event).map_err(|_| js_error("event json failed"))?,
        ),
    )?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrUserTimelineEmptyRelay"),
        &JsValue::from_str(empty_relay_url),
    )?;
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrUserTimelineSocketUrls = [];
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrUserTimelineSocketUrls.push(url);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            const event = JSON.parse(window.__lkjstrUserTimelineFollowEvent);
            const emptyRelay = window.__lkjstrUserTimelineEmptyRelay;
            if (emptyRelay && this.url === emptyRelay) {
              setTimeout(() => {
                this.onmessage && this.onmessage({
                  data: JSON.stringify(['EOSE', sub]),
                });
              }, 0);
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

pub(crate) fn install_empty_follow_list_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        window.__lkjstrOriginalWebSocket = window.WebSocket;
        window.__lkjstrUserTimelineReqCount = 0;
        window.__lkjstrUserTimelineSocketUrls = [];
        window.WebSocket = class {
          constructor(url) {
            this.url = url;
            window.__lkjstrUserTimelineSocketUrls.push(url);
            setTimeout(() => this.onopen && this.onopen({ type: 'open' }), 0);
          }
          send(message) {
            const frame = JSON.parse(message);
            if (frame[0] !== 'REQ') return;
            const sub = frame[1];
            window.__lkjstrUserTimelineReqCount += 1;
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

pub(crate) fn user_timeline_request_count() -> u32 {
    web_sys::window()
        .and_then(|window| {
            js_sys::Reflect::get(&window, &JsValue::from_str("__lkjstrUserTimelineReqCount")).ok()
        })
        .and_then(|value| value.as_f64())
        .map_or(0, |value| value as u32)
}

pub(crate) fn user_timeline_socket_urls() -> Vec<String> {
    web_sys::window()
        .and_then(|window| {
            js_sys::Reflect::get(
                &window,
                &JsValue::from_str("__lkjstrUserTimelineSocketUrls"),
            )
            .ok()
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
        delete window.__lkjstrUserTimelineFollowEvent;
        delete window.__lkjstrUserTimelineEmptyRelay;
        delete window.__lkjstrUserTimelineReplyKind;
        delete window.__lkjstrUserTimelineReplyMessage;
        delete window.__lkjstrUserTimelineReqCount;
        delete window.__lkjstrUserTimelineSocketUrls;
        "#,
    )
    .map(|_| ())
}

pub(crate) fn relay_set() -> RelaySet {
    RelaySet {
        id: "user-timeline-relay-provider".to_owned(),
        name: "User Timeline Relay Provider".to_owned(),
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
