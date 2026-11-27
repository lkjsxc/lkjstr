use super::*;
pub(super) fn process(host: &Rc<RefCell<Host>>, o: &Output) -> bool {
    if let Output::Sign { req, event, .. } = &o {
        let signer = {
            let h = host.borrow();
            match h
                .accounts
                .entries
                .iter()
                .find(|a| a.pubkey == event.pubkey)
                .map(|a| a.signer.as_str())
            {
                Some("local") => "local",
                Some("extension") => "extension",
                Some("remote") => "remote",
                _ => "unknown",
            }
        };
        host.borrow_mut().sign_trace.start(req, event.kind, signer);
        let remote = host.borrow().accounts.remote(&event.pubkey);
        if let Some(remote) = remote {
            let captured = bunker::authority(&host.borrow(), &event.pubkey);
            let Some(captured) = captured else {
                host.borrow_mut()
                    .engine
                    .refuse_sign(req.clone(), "signer-missing");
                return true;
            };
            let owner = match &host.borrow().scope {
                Sink::Dedicated(_) => Some((0, req.clone())),
                Sink::Shared { clients, .. } => {
                    clients.output(o.clone()).into_iter().find_map(|(id, out)| {
                        if let Output::Sign { req, .. } = out {
                            Some((id, req))
                        } else {
                            None
                        }
                    })
                }
                Sink::Closed => None,
            };
            let deadline = host.borrow().engine.signing_deadline(req, event);
            let (Some((client, action_req)), Some(deadline)) = (owner, deadline) else {
                return true;
            };
            let host = host.clone();
            let req = req.clone();
            let event = event.clone();
            wasm_bindgen_futures::spawn_local(async move {
                #[cfg(feature = "harness")]
                bunker::probe::wait(&host, client, &event.pubkey, deadline).await;
                let ms = deadline.saturating_sub(host.borrow().time()).min(60_000) as u32;
                let raw = bunker::call(
                    &host,
                    &remote,
                    bunker::Call {
                        client,
                        account: Some(&event.pubkey),
                        captured: Some(&captured),
                        action_req: Some(&action_req),
                        method: "sign_event",
                        ms,
                        private: false,
                        signal: None,
                    },
                    vec![serde_json::to_string(&event).unwrap_or_default()],
                )
                .await;
                let signed = raw.and_then(|s| {
                    lkjstr_protocol::parse_nostr_event_json(&s, None).map_err(|_| "signer-refused")
                });
                let mut h = host.borrow_mut();
                if !h.stopped && h.engine.signing_deadline(&req, &event) == Some(deadline) {
                    if let Err(code) = signed {
                        h.engine.refuse_sign(req, code);
                        return;
                    }
                    h.signature(req, signed.ok(), None);
                }
            });
            return true;
        }
        let signed = host.borrow().accounts.sign(event);
        match signed {
            Ok(Some(event)) => {
                let mut h = host.borrow_mut();
                h.signature(req.clone(), Some(event), None);
                return true;
            }
            Ok(None) => {}
            Err(code) => {
                host.borrow_mut().engine.refuse_sign(req.clone(), code);
                return true;
            }
        }
    }

    false
}

impl Host {
    pub(super) fn sign_input(
        &mut self,
        input: lkjstr_core::engine::protocol::Input,
        stamp: sign_trace::Stamp,
    ) {
        use lkjstr_core::engine::protocol::Input;
        let now = self.time();
        match input {
            Input::Action { ref req, .. } => {
                self.sign_trace
                    .enqueue(req, stamp, self.flushing, self.account_busy);
                self.engine.input(input, now);
            }
            Input::Signed { req, event, error } => self.signature(req, event, error),
            _ => self.engine.input(input, now),
        }
    }
    pub(super) fn signature(
        &mut self,
        req: String,
        event: Option<lkjstr_protocol::NostrEvent>,
        error: Option<String>,
    ) {
        self.sign_trace.response(&req);
        let mut verified = None;
        self.engine
            .accept_signature(req.clone(), event, error, self.time(), || {
                verified = Some(crate::measure::now());
            });
        self.sign_trace.signed(&req, verified);
    }
}
