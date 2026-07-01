use std::cell::RefCell;
use std::rc::Rc;

use lkjstr_protocol::EventFramePolicy;
use wasm_bindgen::closure::Closure;
use web_sys::{Event, MessageEvent};

use crate::relay_host::{RelaySocketEvent, RelaySocketMessage};

pub(super) type UnitCallback = Rc<RefCell<Box<dyn FnMut()>>>;
pub(super) type MessageCallback = Rc<RefCell<Box<dyn FnMut(RelaySocketMessage)>>>;
pub(super) type EventCallback = Rc<RefCell<Box<dyn FnMut(RelaySocketEvent)>>>;
pub(super) type EventClosure = Closure<dyn FnMut(Event)>;
pub(super) type MessageClosure = Closure<dyn FnMut(MessageEvent)>;

pub struct RelaySocketCallbacks {
    pub(super) on_open: UnitCallback,
    pub(super) on_message: MessageCallback,
    pub(super) on_error: EventCallback,
    pub(super) on_close: EventCallback,
    pub(super) policy: Option<EventFramePolicy>,
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
