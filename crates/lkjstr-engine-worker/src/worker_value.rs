use super::*;
use lkjstr_core::engine::wire::{Input as W, Session, actions::Action as A};

impl Host {
    pub(super) fn receive_value(&mut self, id: u64, value: JsValue) {
        if self.stopped {
            return;
        }
        if let Ok(mut input) = serde_wasm_bindgen::from_value::<W>(value.clone()) {
            if let W::Act {
                req,
                action: A::Upload { bytes, .. },
            } = &mut input
            {
                let raw = js_sys::Reflect::get(&value, &"action".into())
                    .and_then(|a| js_sys::Reflect::get(&a, &"bytes".into()));
                let Ok(raw) = raw else {
                    return;
                };
                if !raw.is_instance_of::<js_sys::ArrayBuffer>() {
                    self.scope
                        .direct(id, &Session::failure(req.clone(), "rejected"));
                    return;
                }
                let array = js_sys::Uint8Array::new(&raw);
                if array.length() > 20 * 1024 * 1024 {
                    self.scope
                        .direct(id, &Session::failure(req.clone(), "too-large"));
                    return;
                }
                *bytes = array.to_vec();
            }
            if let W::Act {
                req,
                action: A::LinkCheck { route, reference },
            } = input
            {
                self.scope
                    .direct(id, &Session::check_link(req, &route, &reference));
                return;
            }
            let stamp = if matches!(input, W::Act { .. }) {
                sign_trace::Stamp::read(&value, !self.loaded)
            } else {
                sign_trace::Stamp::default()
            };
            if !matches!(input, W::Heartbeat | W::Stats { .. } | W::RowAtTime { .. }) {
                self.wake();
            }
            self.receive(id, input, stamp);
        }
    }
}
