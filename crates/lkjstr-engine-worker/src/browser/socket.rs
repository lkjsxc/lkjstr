//! One WebSocket with owned handlers. Dropping it detaches handlers and closes.

use std::{cell::Cell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{CloseEvent, MessageEvent, WebSocket};

type Handler = Closure<dyn FnMut(JsValue)>;

pub struct Socket {
    ws: WebSocket,
    _handlers: [Handler; 4],
}

pub enum SocketEvent {
    Open,
    Message(String),
    Closed(String),
}

impl Socket {
    pub fn connect(url: &str, on: impl FnMut(SocketEvent) + 'static) -> Result<Socket, String> {
        let ws = WebSocket::new(url).map_err(|_| format!("cannot open {url}"))?;
        let sink = std::rc::Rc::new(std::cell::RefCell::new(on));
        let open = {
            let sink = sink.clone();
            Handler::new(move |_| (sink.borrow_mut())(SocketEvent::Open))
        };
        let message = {
            let sink = sink.clone();
            Handler::new(move |value: JsValue| {
                let text = value
                    .dyn_into::<MessageEvent>()
                    .ok()
                    .and_then(|event| event.data().as_string());
                if let Some(text) = text {
                    (sink.borrow_mut())(SocketEvent::Message(text));
                }
            })
        };
        let ended = Rc::new(Cell::new(false));
        let close = {
            let sink = sink.clone();
            let ended = ended.clone();
            Handler::new(move |value: JsValue| {
                if ended.replace(true) {
                    return;
                }
                let reason = value
                    .dyn_into::<CloseEvent>()
                    .ok()
                    .map(|event| match event.reason().as_str() {
                        "" => format!("closed ({})", event.code()),
                        reason => reason.to_owned(),
                    })
                    .unwrap_or_else(|| "closed".to_owned());
                (sink.borrow_mut())(SocketEvent::Closed(reason));
            })
        };
        let error = Handler::new(move |_| {
            if !ended.replace(true) {
                (sink.borrow_mut())(SocketEvent::Closed("connection failed".to_owned()));
            }
        });
        ws.set_onopen(Some(open.as_ref().unchecked_ref()));
        ws.set_onmessage(Some(message.as_ref().unchecked_ref()));
        ws.set_onclose(Some(close.as_ref().unchecked_ref()));
        ws.set_onerror(Some(error.as_ref().unchecked_ref()));
        Ok(Socket {
            ws,
            _handlers: [open, message, close, error],
        })
    }

    pub fn send(&self, text: &str) -> bool {
        self.ws.ready_state() == WebSocket::OPEN && self.ws.send_with_str(text).is_ok()
    }
}

impl Drop for Socket {
    fn drop(&mut self) {
        self.ws.set_onopen(None);
        self.ws.set_onmessage(None);
        self.ws.set_onclose(None);
        self.ws.set_onerror(None);
        let _ = self.ws.close();
    }
}
