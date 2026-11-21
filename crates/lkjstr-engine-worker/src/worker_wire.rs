use super::*;
use lkjstr_core::engine::wire::{Input as W, Output as O, Session, actions::Action as A};
impl Host {
    pub(super) fn receive(&mut self, id: u64, input: W, stamp: sign_trace::Stamp) {
        if self.stopped {
            return;
        }
        if storage::input(self, id, &input) {
            return;
        }
        if matches!(&input, W::Detach | W::Heartbeat) {
            account_failure::input(self, id, input);
            return;
        }
        if account_failure::failed(self) {
            account_failure::input(self, id, input);
            return;
        }
        if !self.loaded {
            if self.startup.len() < 256 {
                self.startup.push((id, input, stamp));
            } else {
                account_failure::input(self, id, input);
            }
            return;
        }
        if bunker::input(self, id, &input) {
            return;
        }
        let Some(input) = keys::receive(self, id, input) else {
            return;
        };
        if zaps::input(self, id, &input) {
            return;
        }
        if private_lists::input(self, id, &input) {
            return;
        }
        if direct_messages::input(self, id, &input) {
            bunker::sync(self);
            return;
        }
        if let W::Configure { config } = &input {
            accounts::configure_client_tag(self, config);
        }
        match input {
            W::Act {
                req,
                action: A::ClientInfo { address },
            } => {
                let now = self.time();
                if let Some(answer) = self.engine.ask_client_info(id, req, &address, now) {
                    self.scope.direct(id, &Session::client_info(answer));
                }
                return;
            }
            W::Act {
                req,
                action: A::NoteReveal { sub, key, reveal },
            } => {
                let at = self.time();
                self.engine.advance_visibility_clock(at);
                if let Some(session) = self.sessions.get(&id) {
                    for output in
                        session
                            .borrow_mut()
                            .note_reveal(req, &sub, &key, reveal, &self.engine)
                    {
                        self.scope.direct(id, &output);
                    }
                }
                return;
            }
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
                        stats: self.sign_trace.stats(&self.engine),
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
            W::Relays {
                relays,
                account,
                cached,
                defaults,
                uses_defaults,
            } => {
                let local = (!uses_defaults).then(|| relays.clone());
                self.engine
                    .configure_note_routes(account, local, cached, defaults);
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
                        self.sign_input(input, stamp);
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
        let begin = crate::measure::now();
        private_lists::sync(self);
        bunker::sync(self);
        self.sign_trace.span(sign_trace::Activity::Sync, begin);
        if refresh_previews {
            previews::refresh(self);
        }
    }
}
