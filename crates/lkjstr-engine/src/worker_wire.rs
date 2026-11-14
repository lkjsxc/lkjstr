use super::*;
impl Host {
    pub(super) fn receive(&mut self, id: u64, input: lkjstr_core::engine::wire::Input) {
        let opened = if let lkjstr_core::engine::wire::Input::Open { sub, .. } = &input {
            Some(sub.clone())
        } else {
            None
        };
        let translated = self
            .sessions
            .get(&id)
            .map(|s| s.borrow_mut().input(input, &self.engine));
        match translated {
            Some(Ok(inputs)) => {
                for input in inputs {
                    let at = self.time();
                    let inputs = if let Sink::Shared { clients, .. } = &mut self.scope {
                        clients.input(id, input, at)
                    } else {
                        vec![input]
                    };
                    for input in inputs {
                        self.engine.input(input, self.time());
                    }
                }
            }
            Some(Err((Some(req), code))) => self
                .scope
                .direct(id, &lkjstr_core::engine::wire::Session::failure(req, code)),
            Some(Err((None, _))) => {
                if let Some(sub) = opened {
                    self.scope.direct(id,&lkjstr_core::engine::wire::Output::State{sub,state:serde_json::json!({"phase":"failed","relaysAsked":0,"relaysAnswered":0,"error":"unsupported"})});
                }
            }
            _ => {}
        }
    }
}
#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn set_test_relays(&mut self, urls: JsValue) {
        if let Ok(relays) = serde_wasm_bindgen::from_value::<Vec<String>>(urls) {
            let mut h = self.host.borrow_mut();
            let at = h.time();
            h.engine.input(Input::Configure { relays }, at);
        }
    }
}
