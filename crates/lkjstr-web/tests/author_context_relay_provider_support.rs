#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use lkjstr_domain::{RelayConnectionState, RelayHealth, RelayPurpose, RelayRecord, RelaySet};
use lkjstr_protocol::NostrEvent;
use lkjstr_storage::AuthorRelayRouteRecord;
use wasm_bindgen::prelude::JsValue;

pub(crate) const SELECTED_RELAY: &str = "wss://selected.example";

pub(crate) fn install_author_context_websocket(event: &NostrEvent) -> Result<(), JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    js_sys::Reflect::set(
        &window,
        &JsValue::from_str("__lkjstrAuthorContextEvent"),
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
            const event = JSON.parse(window.__lkjstrAuthorContextEvent);
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

pub(crate) fn restore_websocket() -> Result<(), JsValue> {
    js_sys::eval(
        r#"
        if (window.__lkjstrOriginalWebSocket) {
          window.WebSocket = window.__lkjstrOriginalWebSocket;
          delete window.__lkjstrOriginalWebSocket;
        }
        delete window.__lkjstrAuthorContextEvent;
        "#,
    )
    .map(|_| ())
}

pub(crate) fn relay_set() -> RelaySet {
    RelaySet {
        id: "author-context-relay-provider".to_owned(),
        name: "Author Context Relay Provider".to_owned(),
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

pub(crate) fn author_route(pubkey: String) -> AuthorRelayRouteRecord {
    AuthorRelayRouteRecord {
        pubkey,
        relay_url: SELECTED_RELAY.to_owned(),
        route_kind: "nip65".to_owned(),
        evidence_json: "{}".to_owned(),
        updated_at_ms: 9,
        expires_at_ms: None,
    }
}

fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
