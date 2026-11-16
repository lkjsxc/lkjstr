//! Short-lived NIP-46 RPC sockets, closed on success, failure and 60s timeout.
use super::{
    promise,
    socket::{Socket, SocketEvent},
};
use lkjstr_protocol::{
    RelayMessage,
    remote::{AuthUrl, Remote, Response},
};
use serde_json::json;
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::JsValue;
pub type ChallengeHandler = Rc<dyn Fn(AuthUrl) -> Result<(), &'static str>>;
type SocketSlot = Rc<RefCell<Option<Socket>>>;
struct Cleanup(Rc<RefCell<Vec<SocketSlot>>>);
impl Drop for Cleanup {
    fn drop(&mut self) {
        for slot in self.0.borrow_mut().drain(..) {
            slot.borrow_mut().take();
        }
    }
}
pub async fn rpc_for_signal(
    remote: &Remote,
    method: &str,
    params: Vec<String>,
    ms: u32,
    signal: Option<&web_sys::AbortSignal>,
) -> Result<String, &'static str> {
    rpc_mode(remote, method, params, ms, signal, false, None).await
}
pub async fn rpc_owned(
    remote: &Remote,
    method: &str,
    params: Vec<String>,
    ms: u32,
    signal: Option<&web_sys::AbortSignal>,
    private: bool,
    challenge: ChallengeHandler,
) -> Result<String, &'static str> {
    rpc_mode(remote, method, params, ms, signal, private, Some(challenge)).await
}
async fn rpc_mode(
    remote: &Remote,
    method: &str,
    params: Vec<String>,
    ms: u32,
    signal: Option<&web_sys::AbortSignal>,
    private: bool,
    challenge: Option<ChallengeHandler>,
) -> Result<String, &'static str> {
    super::abort::check(signal).map_err(|_| super::abort::CANCELLED)?;
    let id = lkjstr_protocol::upload::hash(lkjstr_protocol::generate_secret_key().as_bytes());
    let event = remote
        .request(&id, method, params, js_sys::Date::now() as u64 / 1000)
        .ok_or("internal")?;
    let slots: Rc<RefCell<Vec<SocketSlot>>> = Rc::default();
    let _cleanup = Cleanup(slots.clone());
    let request=json!(["REQ",id,{"kinds":[24133],"authors":[remote.peer],"#p":[remote.client().ok_or("internal")?],"since":event.created_at.saturating_sub(60)}]).to_string();
    let publication = json!(["EVENT", event]).to_string();
    let remaining = Rc::new(Cell::new(remote.relays.len()));
    let settled = Rc::new(Cell::new(false));
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        for url in &remote.relays {
            let session = remote.clone();
            let challenge = challenge.clone();
            let settled = settled.clone();
            let remaining = remaining.clone();
            let closed = Cell::new(false);
            let id = id.clone();
            let resolve = resolve.clone();
            let reject = reject.clone();
            let slot: SocketSlot = Rc::default();
            let socket_slot = slot.clone();
            let request = request.clone();
            let publication = publication.clone();
            let failed = remaining.clone();
            let fail = reject.clone();
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
                        && !settled.get()
                        && let Some(result) = session.classify_response(&event, &id, private)
                    {
                        match result {
                            Response::Authenticate(url) => {
                                let result = challenge
                                    .as_ref()
                                    .map_or(Err("unsupported"), |callback| callback(url));
                                if let Err(code) = result {
                                    settled.set(true);
                                    let value = match code {
                                        "unsupported" => "bunker-auth-unsupported",
                                        "too-large" => "bunker-auth-limited",
                                        "offline" => "bunker-auth-revoked",
                                        "signer-timeout" => "bunker-auth-timeout",
                                        _ => "signer-refused",
                                    };
                                    let _ = reject.call1(&JsValue::NULL, &value.into());
                                }
                            }
                            Response::Complete(result) => {
                                settled.set(true);
                                match result {
                                    Ok(value) => {
                                        let _ = resolve.call1(&JsValue::NULL, &value.into());
                                    }
                                    Err(code) => {
                                        let _ = reject.call1(&JsValue::NULL, &code.into());
                                    }
                                }
                            }
                        }
                    }
                }
                SocketEvent::Closed(_) => {
                    if !closed.replace(true) {
                        remaining.set(remaining.get().saturating_sub(1));
                        if remaining.get() == 0 {
                            let _ = reject.call1(&JsValue::NULL, &"signer-missing".into());
                        }
                    }
                }
            });
            if let Ok(socket) = result {
                *slot.borrow_mut() = Some(socket);
                slots.borrow_mut().push(slot);
            } else {
                failed.set(failed.get().saturating_sub(1));
                if failed.get() == 0 {
                    let _ = fail.call1(&JsValue::NULL, &"signer-missing".into());
                }
            }
        }
    });
    let _parent = signal
        .map(|signal| {
            let slots = slots.clone();
            super::abort::listen(signal, move || {
                for slot in slots.borrow_mut().drain(..) {
                    slot.borrow_mut().take();
                }
            })
        })
        .transpose()
        .map_err(|_| "internal")?;
    let result = promise::bounded_ms_for(
        done,
        ms,
        if private {
            "signer-timeout"
        } else {
            "signer-missing"
        },
        || {},
        signal,
    )
    .await;
    for slot in slots.borrow_mut().drain(..) {
        slot.borrow_mut().take();
    }
    result
        .map_err(|e| {
            if e.as_string().as_deref() == Some("bunker-auth-unsupported") {
                "unsupported"
            } else if e.as_string().as_deref() == Some("bunker-auth-limited") {
                "too-large"
            } else if e.as_string().as_deref() == Some("bunker-auth-revoked") {
                "offline"
            } else if e.as_string().as_deref() == Some("bunker-auth-timeout") {
                if private {
                    "signer-timeout"
                } else {
                    "signer-missing"
                }
            } else if e.as_string().as_deref() == Some(super::abort::CANCELLED) {
                super::abort::CANCELLED
            } else if private && e.as_string().as_deref() == Some("signer-timeout") {
                "signer-timeout"
            } else if private && e.as_string().as_deref() == Some("unsupported") {
                "unsupported"
            } else if e.as_string().as_deref() == Some("signer-refused") {
                "signer-refused"
            } else {
                "signer-missing"
            }
        })?
        .as_string()
        .ok_or("signer-refused")
}
