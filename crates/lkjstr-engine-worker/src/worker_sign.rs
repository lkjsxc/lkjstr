use super::*;
pub(super) fn process(host: &Rc<RefCell<Host>>, o: &Output) -> bool {
    if let Output::Sign { req, event } = &o {
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
                    let at = h.time();
                    if let Err(code) = signed {
                        h.engine.refuse_sign(req, code);
                        return;
                    }
                    h.engine.input(
                        lkjstr_core::engine::protocol::Input::Signed {
                            req,
                            event: signed.ok(),
                            error: None,
                        },
                        at,
                    );
                }
            });
            return true;
        }
        let signed = host.borrow().accounts.sign(event);
        match signed {
            Ok(Some(event)) => {
                let mut h = host.borrow_mut();
                let at = h.time();
                h.engine.input(
                    lkjstr_core::engine::protocol::Input::Signed {
                        req: req.clone(),
                        event: Some(event),
                        error: None,
                    },
                    at,
                );
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
