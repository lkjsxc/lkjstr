use super::*;
use lkjstr_core::engine::wire::{Input as W, Output as O, Session, actions::Action as A};
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
            self.receive(id, input);
        }
    }
    pub(super) fn receive(&mut self, id: u64, input: lkjstr_core::engine::wire::Input) {
        if self.stopped {
            return;
        }
        if !self.loaded {
            if self.startup.len() < 256 {
                self.startup.push((id, input));
            }
            return;
        }
        let Some(input) = keys::receive(self, id, input) else {
            return;
        };
        if zaps::input(self, id, &input) {
            return;
        }
        if direct_messages::input(self, id, &input) {
            return;
        }
        if let W::Configure { config } = &input {
            self.engine.client_tag = config.client_tag.unwrap_or(true);
        }
        match input {
            W::Act {
                req,
                action: A::ServersCheck { server },
            } => {
                uploads::checks::start(self, id, req, server);
                return;
            }
            W::Stats { req } => {
                self.scope.direct(
                    id,
                    &O::Stats {
                        req,
                        stats: self.engine.stats(),
                    },
                );
                return;
            }
            W::RowAtTime { req, sub, at } => {
                if let Some(session) = self.sessions.get(&id) {
                    self.scope.direct(
                        id,
                        &session.borrow().row_at_time(req, sub, at, &self.engine),
                    );
                }
                return;
            }
            W::Signed {
                ref req, ref event, ..
            } if self.upload_auth.contains_key(&(id, req.clone())) => {
                if let Some((_, resolve)) = self.upload_auth.remove(&(id, req.clone())) {
                    let _ = resolve.call1(
                        &JsValue::NULL,
                        &event.clone().map(JsValue::from).unwrap_or(JsValue::NULL),
                    );
                }
                return;
            }
            W::UploadCancel { req } => {
                uploads::control::cancel(self, id, &req);
                return;
            }
            W::Act {
                req,
                action: action @ A::Upload { .. },
            } => {
                uploads::input::enqueue(self, id, req, action);
                return;
            }
            W::Act {
                req,
                action: A::RelaysSave { account, relays },
            } if account.is_empty() && self.accounts.active.is_none() => {
                let result = self.save_visitor_relays(req, relays);
                self.scope.direct(id, &result);
                return;
            }
            W::Heartbeat => {
                self.scope.direct(id, &O::Heartbeat);
                if let Sink::Shared { clients, .. } = &mut self.scope {
                    clients.heartbeat(id, now());
                }
                return;
            }
            W::Detach => {
                shared::detach(self, id);
                return;
            }
            W::Relays { relays } => {
                self.bootstrap(relays);
                return;
            }
            W::PublicKey { req, pubkey, error } => {
                if self.discovery.remove(&(id, req.clone())).is_some() {
                    if error.is_none() && pubkey.as_deref().is_some_and(lkjstr_protocol::is_pubkey)
                    {
                        self.account_tasks.push((
                            id,
                            req,
                            A::AccountAdd {
                                how: "extension".into(),
                                key: pubkey,
                            },
                        ));
                    } else {
                        self.scope.direct(
                            id,
                            &Session::failure(
                                req,
                                if error.as_deref() == Some("signer-missing") {
                                    "signer-missing"
                                } else {
                                    "signer-refused"
                                },
                            ),
                        );
                    }
                }
                return;
            }
            W::Act {
                req,
                action: A::AccountAdd { how, key },
            } => {
                if how == "extension" {
                    if self.discovery.len() >= 32 {
                        self.scope.direct(id, &Session::failure(req, "too-large"));
                    } else {
                        self.discovery
                            .insert((id, req.clone()), self.time() + 60000);
                        self.scope.direct(id, &O::GetPublicKey { req });
                    }
                } else if self.account_tasks.len() < 32 {
                    self.account_tasks
                        .push((id, req, A::AccountAdd { how, key }));
                } else {
                    self.scope.direct(id, &Session::failure(req, "too-large"));
                }
                return;
            }
            W::Act {
                req,
                action:
                    action @ (A::AccountUse { .. }
                    | A::AccountRemove { .. }
                    | A::Seen { .. }
                    | A::ChannelSeen { .. }),
            } => {
                if self.account_tasks.len() < 32 {
                    self.account_tasks.push((id, req, action));
                } else {
                    self.scope.direct(id, &Session::failure(req, "too-large"));
                }
                return;
            }
            _ => {}
        }
        let opened = match &input {
            W::Open { sub, .. } => Some(sub.clone()),
            _ => None,
        };
        let refresh_previews = matches!(&input, W::Configure { .. } | W::Hint { .. });
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
            Some(Err((Some(req), code))) => self.scope.direct(id, &Session::failure(req, code)),
            Some(Err((None, _))) => {
                if let Some(sub) = opened {
                    self.scope.direct(id,&O::State{sub,state:serde_json::json!({"phase":"failed","relaysAsked":0,"relaysAnswered":0,"error":"unsupported"})});
                }
            }
            _ => {}
        }
        if refresh_previews {
            previews::refresh(self);
        }
    }
}
