//! Upload authorization uses the same exact-event checks for every signer.
use super::*;
use lkjstr_core::engine::wire::Output as W;
use lkjstr_protocol::UnsignedNostrEvent;
pub(super) async fn sign(
    host: &Rc<RefCell<Host>>,
    id: u64,
    deadline: Deadline,
    event: UnsignedNostrEvent,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    let remote = host.borrow().accounts.remote(&event.pubkey);
    if let Some(remote) = remote {
        let raw = crate::browser::remote::rpc_for(
            &remote,
            "sign_event",
            vec![serde_json::to_string(&event).map_err(|_| "internal")?],
            deadline.wait(clock(), 60_000)?,
        )
        .await?;
        let signed =
            lkjstr_protocol::parse_nostr_event_json(&raw, None).map_err(|_| "signer-refused")?;
        lkjstr_core::actions::validate_signed_event(&event, &signed)
            .map_err(|_| "signer-refused")?;
        return Ok(signed);
    }
    deadline.wait(clock(), 1)?;
    let local = host.borrow().accounts.sign(&event)?;
    if let Some(event) = local {
        return Ok(event);
    }
    let ms = deadline.wait(clock(), 60_000)?;
    let req = {
        let mut h = host.borrow_mut();
        h.auth_next += 1;
        format!("upload-auth-{}", h.auth_next)
    };
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let mut h = host.borrow_mut();
        h.upload_auth
            .insert((id, req.clone()), (event.clone(), resolve));
        h.scope.direct(
            id,
            &W::Sign {
                req: req.clone(),
                pubkey: event.pubkey.clone(),
                event: serde_json::to_string(&event).unwrap_or_default(),
            },
        );
    });
    let result = crate::browser::promise::bounded_ms(promise, ms, "signer-missing", || {}).await;
    host.borrow_mut().upload_auth.remove(&(id, req));
    let raw = result
        .map_err(|_| "signer-missing")?
        .as_string()
        .ok_or("signer-refused")?;
    let signed =
        lkjstr_protocol::parse_nostr_event_json(&raw, None).map_err(|_| "signer-refused")?;
    lkjstr_core::actions::validate_signed_event(&event, &signed).map_err(|_| "signer-refused")?;
    Ok(signed)
}
