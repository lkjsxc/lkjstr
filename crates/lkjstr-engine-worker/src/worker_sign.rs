use super::*;
pub(super) fn process(host: &Rc<RefCell<Host>>, o: &Output) -> bool {
    if let Output::Sign { req, event } = &o {
        let remote = host.borrow().accounts.remote(&event.pubkey);
        if let Some(remote) = remote {
            let host = host.clone();
            let req = req.clone();
            let event = event.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let raw = crate::browser::remote::rpc(
                    &remote,
                    "sign_event",
                    vec![serde_json::to_string(&event).unwrap_or_default()],
                )
                .await;
                let signed = raw.and_then(|s| {
                    lkjstr_protocol::parse_nostr_event_json(&s, None).map_err(|_| "signer-refused")
                });
                let mut h = host.borrow_mut();
                if !h.stopped {
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
