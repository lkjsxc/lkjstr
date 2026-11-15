//! Short-lived NIP-46 RPC sockets, closed on success, failure and 60s timeout.
use super::{
    promise,
    socket::{Socket, SocketEvent},
};
use lkjstr_protocol::{RelayMessage, remote::Remote};
use serde_json::json;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::JsValue;
type SocketSlot = Rc<RefCell<Option<Socket>>>;
pub async fn rpc(
    remote: &Remote,
    method: &str,
    params: Vec<String>,
) -> Result<String, &'static str> {
    let id = lkjstr_protocol::upload::hash(lkjstr_protocol::generate_secret_key().as_bytes());
    let event = remote
        .request(&id, method, params, js_sys::Date::now() as u64 / 1000)
        .ok_or("internal")?;
    let slots: Rc<RefCell<Vec<SocketSlot>>> = Rc::default();
    let request=json!(["REQ",id,{"kinds":[24133],"authors":[remote.peer],"#p":[remote.client().ok_or("internal")?],"since":event.created_at.saturating_sub(60)}]).to_string();
    let publication = json!(["EVENT", event]).to_string();
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        for url in &remote.relays {
            let session = remote.clone();
            let id = id.clone();
            let resolve = resolve.clone();
            let reject = reject.clone();
            let slot: SocketSlot = Rc::default();
            let socket_slot = slot.clone();
            let request = request.clone();
            let publication = publication.clone();
            let result = Socket::connect(url, move |event| match event {
                SocketEvent::Open => {
                    if let Some(s) = socket_slot.borrow().as_ref() {
                        s.send(&request);
                        s.send(&publication);
                    }
                }
                SocketEvent::Message(raw) => {
                    if raw.len() > 2 * 1024 * 1024 {
                        return;
                    }
                    if let Ok(RelayMessage::Event { event, .. }) =
                        lkjstr_protocol::parse_relay_message(&raw, None)
                        && let Some(result) = session.response(&event, &id)
                    {
                        match result {
                            Ok(value) => {
                                let _ = resolve.call1(&JsValue::NULL, &value.into());
                            }
                            Err(_) => {
                                let _ = reject.call1(&JsValue::NULL, &"signer-refused".into());
                            }
                        }
                    }
                }
                _ => {}
            });
            if let Ok(socket) = result {
                *slot.borrow_mut() = Some(socket);
                slots.borrow_mut().push(slot);
            }
        }
    });
    let result = promise::bounded(done, 60, "signer-missing", || {}).await;
    for slot in slots.borrow_mut().drain(..) {
        slot.borrow_mut().take();
    }
    result
        .map_err(|_| "signer-missing")?
        .as_string()
        .ok_or("signer-refused")
}
