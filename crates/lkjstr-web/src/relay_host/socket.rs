use std::cell::RefCell;
use std::rc::Rc;

use lkjstr_protocol::EventFramePolicy;
use wasm_bindgen::{JsCast, closure::Closure};
use web_sys::{Event, MessageEvent, WebSocket};

use crate::relay_host::{
    RelayHostProblem, RelayHostProblemKind, RelayHostResult, RelaySocketMessage, parse_socket_text,
};

type UnitCallback = Rc<RefCell<Box<dyn FnMut()>>>;
type MessageCallback = Rc<RefCell<Box<dyn FnMut(RelaySocketMessage)>>>;
type EventCallback = Rc<RefCell<Box<dyn FnMut(RelaySocketEvent)>>>;
type EventClosure = Closure<dyn FnMut(Event)>;
type MessageClosure = Closure<dyn FnMut(MessageEvent)>;

pub struct RelaySocketCallbacks {
    on_open: UnitCallback,
    on_message: MessageCallback,
    on_error: EventCallback,
    on_close: EventCallback,
    policy: Option<EventFramePolicy>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelaySocketEvent {
    pub kind: &'static str,
    pub reason: String,
}

pub struct RelaySocketHandle {
    socket: Option<WebSocket>,
    on_open: Option<EventClosure>,
    on_close: Option<EventClosure>,
    on_error: Option<EventClosure>,
    on_message: Option<MessageClosure>,
}

impl RelaySocketCallbacks {
    pub fn new(
        on_open: impl FnMut() + 'static,
        on_message: impl FnMut(RelaySocketMessage) + 'static,
        on_error: impl FnMut(RelaySocketEvent) + 'static,
        on_close: impl FnMut(RelaySocketEvent) + 'static,
    ) -> Self {
        Self::with_optional_policy(None, on_open, on_message, on_error, on_close)
    }

    pub fn with_policy(
        policy: EventFramePolicy,
        on_open: impl FnMut() + 'static,
        on_message: impl FnMut(RelaySocketMessage) + 'static,
        on_error: impl FnMut(RelaySocketEvent) + 'static,
        on_close: impl FnMut(RelaySocketEvent) + 'static,
    ) -> Self {
        Self::with_optional_policy(Some(policy), on_open, on_message, on_error, on_close)
    }

    fn with_optional_policy(
        policy: Option<EventFramePolicy>,
        on_open: impl FnMut() + 'static,
        on_message: impl FnMut(RelaySocketMessage) + 'static,
        on_error: impl FnMut(RelaySocketEvent) + 'static,
        on_close: impl FnMut(RelaySocketEvent) + 'static,
    ) -> Self {
        Self {
            on_open: Rc::new(RefCell::new(Box::new(on_open))),
            on_message: Rc::new(RefCell::new(Box::new(on_message))),
            on_error: Rc::new(RefCell::new(Box::new(on_error))),
            on_close: Rc::new(RefCell::new(Box::new(on_close))),
            policy,
        }
    }
}

impl RelaySocketEvent {
    fn new(kind: &'static str, reason: impl Into<String>) -> Self {
        Self {
            kind,
            reason: reason.into(),
        }
    }
}

impl RelaySocketHandle {
    pub fn connect(url: &str, callbacks: RelaySocketCallbacks) -> RelayHostResult<Self> {
        let socket = WebSocket::new(url).map_err(|error| {
            RelayHostProblem::js(RelayHostProblemKind::InvalidUrl, "websocket-open", error)
        })?;
        let mut handle = Self {
            socket: Some(socket),
            on_open: None,
            on_close: None,
            on_error: None,
            on_message: None,
        };
        handle.install(callbacks);
        Ok(handle)
    }

    pub fn ready_state(&self) -> Option<u16> {
        self.socket.as_ref().map(WebSocket::ready_state)
    }

    pub fn send_text(&self, message: &str) -> RelayHostResult<()> {
        let Some(socket) = &self.socket else {
            return Err(RelayHostProblem::new(
                RelayHostProblemKind::Canceled,
                "websocket-send",
                "closed",
            ));
        };
        socket.send_with_str(message).map_err(|error| {
            RelayHostProblem::js(RelayHostProblemKind::SendFailed, "websocket-send", error)
        })
    }

    pub fn close(&mut self) -> RelayHostResult<()> {
        self.detach();
        let Some(socket) = self.socket.take() else {
            return Ok(());
        };
        socket.close().map_err(|error| {
            RelayHostProblem::js(RelayHostProblemKind::Canceled, "websocket-close", error)
        })
    }

    fn install(&mut self, callbacks: RelaySocketCallbacks) {
        let Some(socket) = &self.socket else {
            return;
        };
        let on_open = open_closure(callbacks.on_open.clone());
        socket.set_onopen(Some(on_open.as_ref().unchecked_ref()));
        self.on_open = Some(on_open);

        let on_message = message_closure(
            callbacks.on_message.clone(),
            callbacks.on_error.clone(),
            callbacks.policy,
        );
        socket.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
        self.on_message = Some(on_message);

        let on_error = event_closure("error", callbacks.on_error);
        socket.set_onerror(Some(on_error.as_ref().unchecked_ref()));
        self.on_error = Some(on_error);

        let on_close = event_closure("close", callbacks.on_close);
        socket.set_onclose(Some(on_close.as_ref().unchecked_ref()));
        self.on_close = Some(on_close);
    }

    fn detach(&mut self) {
        if let Some(socket) = &self.socket {
            socket.set_onopen(None);
            socket.set_onmessage(None);
            socket.set_onerror(None);
            socket.set_onclose(None);
        }
        self.on_open.take();
        self.on_message.take();
        self.on_error.take();
        self.on_close.take();
    }
}

impl Drop for RelaySocketHandle {
    fn drop(&mut self) {
        let _result = self.close();
    }
}

fn open_closure(callback: UnitCallback) -> EventClosure {
    Closure::wrap(Box::new(move |_event: Event| {
        callback.borrow_mut().as_mut()();
    }) as Box<dyn FnMut(_)>)
}

fn event_closure(kind: &'static str, callback: EventCallback) -> EventClosure {
    Closure::wrap(Box::new(move |event: Event| {
        callback.borrow_mut().as_mut()(RelaySocketEvent::new(kind, event.type_()));
    }) as Box<dyn FnMut(_)>)
}

fn message_closure(
    message: MessageCallback,
    error: EventCallback,
    policy: Option<EventFramePolicy>,
) -> MessageClosure {
    Closure::wrap(Box::new(move |event: MessageEvent| {
        if let Some(text) = event.data().as_string() {
            message.borrow_mut().as_mut()(parse_socket_text(&text, policy.as_ref()));
        } else {
            error.borrow_mut().as_mut()(RelaySocketEvent::new("unsupported-message", "non-text"));
        }
    }) as Box<dyn FnMut(_)>)
}
