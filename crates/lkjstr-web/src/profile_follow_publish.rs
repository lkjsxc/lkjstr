use std::cell::{Cell, RefCell};
use std::rc::Rc;

use lkjstr_protocol::{ClientMessage, NostrEvent, RelayMessage, encode_client_message};
use wasm_bindgen::prelude::JsValue;
use wasm_bindgen_futures::JsFuture;

use crate::relay_host::{
    BrowserTimeout, RelaySocketCallbacks, RelaySocketHandle, RelaySocketMessage,
};

const PUBLISH_TIMEOUT_MS: u32 = 8_000;

pub(crate) async fn publish_follow_event(
    relays: &[String],
    event: &NostrEvent,
) -> Vec<Result<String, String>> {
    let futures = relays
        .iter()
        .map(|relay| {
            (
                relay.clone(),
                JsFuture::from(publish_relay_promise(relay.clone(), event.clone())),
            )
        })
        .collect::<Vec<_>>();
    let mut out = Vec::with_capacity(futures.len());
    for (relay, future) in futures {
        out.push(match future.await {
            Ok(_) => Ok(relay),
            Err(error) => Err(format!("{relay}: {}", js_reason(error))),
        });
    }
    out
}

struct PublishState {
    done: Cell<bool>,
    handle: RefCell<Option<RelaySocketHandle>>,
    timer: RefCell<Option<BrowserTimeout>>,
}

impl PublishState {
    fn new() -> Self {
        Self {
            done: Cell::new(false),
            handle: RefCell::new(None),
            timer: RefCell::new(None),
        }
    }

    fn clear(&self) {
        self.timer.borrow_mut().take();
        if let Some(mut handle) = self.handle.borrow_mut().take() {
            let _result = handle.close();
        }
    }
}

fn publish_relay_promise(relay: String, event: NostrEvent) -> js_sys::Promise {
    let frame = match encode_client_message(&ClientMessage::Event(event.clone())) {
        Ok(frame) => frame,
        Err(error) => return rejected_promise(&format!("event encode failed: {error:?}")),
    };
    js_sys::Promise::new(&mut move |resolve, reject| {
        let state = Rc::new(PublishState::new());
        let resolve = Rc::new(resolve);
        let reject = Rc::new(reject);
        let succeed = success_callback(state.clone(), resolve);
        let fail = failure_callback(state.clone(), reject);
        let timer = BrowserTimeout::schedule(PUBLISH_TIMEOUT_MS, {
            let fail = fail.clone();
            move || fail("relay publish timed out".to_owned())
        });
        match timer {
            Ok(timer) => state.timer.borrow_mut().replace(timer),
            Err(problem) => {
                fail(format!("{}: {}", problem.operation, problem.reason));
                return;
            }
        };
        let callbacks = publish_callbacks(state.clone(), frame.clone(), event.id.clone(), succeed, fail.clone());
        match RelaySocketHandle::connect(&relay, callbacks) {
            Ok(handle) => {
                state.handle.borrow_mut().replace(handle);
            }
            Err(problem) => fail(format!("{}: {}", problem.operation, problem.reason)),
        }
    })
}

fn publish_callbacks(
    state: Rc<PublishState>,
    frame: String,
    event_id: String,
    succeed: Rc<dyn Fn()>,
    fail: Rc<dyn Fn(String)>,
) -> RelaySocketCallbacks {
    RelaySocketCallbacks::new(
        {
            let fail = fail.clone();
            move || send_frame(&state, &frame, &fail)
        },
        {
            let fail = fail.clone();
            move |message| publish_message(message, &event_id, &succeed, &fail)
        },
        {
            let fail = fail.clone();
            move |event| fail(format!("socket {}: {}", event.kind, event.reason))
        },
        move |event| fail(format!("socket {}: {}", event.kind, event.reason)),
    )
}

fn send_frame(state: &Rc<PublishState>, frame: &str, fail: &Rc<dyn Fn(String)>) {
    if let Some(handle) = state.handle.borrow().as_ref()
        && let Err(problem) = handle.send_text(frame)
    {
        fail(format!("{}: {}", problem.operation, problem.reason));
    }
}

fn publish_message(
    message: RelaySocketMessage,
    expected_id: &str,
    succeed: &Rc<dyn Fn()>,
    fail: &Rc<dyn Fn(String)>,
) {
    match message {
        RelaySocketMessage::Relay(RelayMessage::Ok {
            event_id,
            accepted,
            message: _,
        }) if event_id == expected_id && accepted => succeed(),
        RelaySocketMessage::Relay(RelayMessage::Ok {
            event_id,
            message,
            ..
        }) if event_id == expected_id => fail(format!("relay rejected event: {message}")),
        RelaySocketMessage::Relay(RelayMessage::Notice(message)) => {
            fail(format!("relay notice: {message}"));
        }
        RelaySocketMessage::Relay(RelayMessage::Auth(_)) => fail("relay auth required".to_owned()),
        RelaySocketMessage::ParseError { message, .. } => {
            fail(format!("relay response parse failed: {message}"));
        }
        _ => {}
    }
}

fn success_callback(state: Rc<PublishState>, resolve: Rc<js_sys::Function>) -> Rc<dyn Fn()> {
    Rc::new(move || {
        if state.done.replace(true) {
            return;
        }
        state.clear();
        let _result = resolve.call1(&JsValue::NULL, &JsValue::TRUE);
    })
}

fn failure_callback(
    state: Rc<PublishState>,
    reject: Rc<js_sys::Function>,
) -> Rc<dyn Fn(String)> {
    Rc::new(move |message| {
        if state.done.replace(true) {
            return;
        }
        state.clear();
        let _result = reject.call1(&JsValue::NULL, &JsValue::from_str(&message));
    })
}

fn rejected_promise(reason: &str) -> js_sys::Promise {
    js_sys::Promise::reject(&JsValue::from_str(reason))
}

fn js_reason(value: JsValue) -> String {
    value.as_string().unwrap_or_else(|| {
        js_sys::Reflect::get(&value, &JsValue::from_str("message"))
            .ok()
            .and_then(|message| message.as_string())
            .unwrap_or_else(|| "javascript-error".to_owned())
    })
}
