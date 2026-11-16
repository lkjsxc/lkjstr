//! Upload authorization uses the same exact-event checks for every signer.
use super::*;
use lkjstr_core::engine::wire::Output as W;
use lkjstr_protocol::UnsignedNostrEvent;
pub(in crate::worker) async fn sign(
    host: &Rc<RefCell<Host>>,
    id: u64,
    deadline: Deadline,
    event: UnsignedNostrEvent,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    sign_for(host, id, deadline, event, None, None).await
}
pub(in crate::worker) async fn sign_for(
    host: &Rc<RefCell<Host>>,
    id: u64,
    deadline: Deadline,
    event: UnsignedNostrEvent,
    signal: Option<&web_sys::AbortSignal>,
    action_req: Option<&str>,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    sign_mode(host, id, deadline, event, signal, action_req, false).await
}
pub(in crate::worker) async fn private_sign(
    host: &Rc<RefCell<Host>>,
    id: u64,
    deadline: Deadline,
    event: UnsignedNostrEvent,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    sign_mode(host, id, deadline, event, None, None, true).await
}
async fn sign_mode(
    host: &Rc<RefCell<Host>>,
    id: u64,
    deadline: Deadline,
    event: UnsignedNostrEvent,
    signal: Option<&web_sys::AbortSignal>,
    action_req: Option<&str>,
    private: bool,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    crate::browser::abort::check(signal).map_err(|_| crate::browser::abort::CANCELLED)?;
    let remote = host.borrow().accounts.remote(&event.pubkey);
    if let Some(remote) = remote {
        let params = vec![serde_json::to_string(&event).map_err(|_| "internal")?];
        let ms = deadline.wait(clock(), 60_000)?;
        let raw = if private {
            crate::browser::remote::rpc_private(&remote, "sign_event", params, ms, signal).await
        } else {
            crate::browser::remote::rpc_for_signal(&remote, "sign_event", params, ms, signal).await
        }?;
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
    let nonce = crate::browser::random_bytes::<16>()?;
    let req = {
        let mut h = host.borrow_mut();
        h.auth_next = h.auth_next.checked_add(1).ok_or("internal")?;
        format!("upload-auth-{}-{}", h.auth_next, lkjstr_nips::hex(&nonce))
    };
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let mut h = host.borrow_mut();
        h.upload_auth
            .insert((id, req.clone()), (event.clone(), resolve));
        h.scope.direct(
            id,
            &W::Sign {
                action_req: action_req.map(str::to_owned),
                req: req.clone(),
                pubkey: event.pubkey.clone(),
                event: serde_json::to_string(&event).unwrap_or_default(),
            },
        );
    });
    let result = crate::browser::promise::bounded_ms_for(
        promise,
        ms,
        if private {
            "signer-timeout"
        } else {
            "signer-missing"
        },
        || {},
        signal,
    )
    .await;
    host.borrow_mut().upload_auth.remove(&(id, req));
    let raw = result
        .map_err(|error| {
            if error.as_string().as_deref() == Some(crate::browser::abort::CANCELLED) {
                crate::browser::abort::CANCELLED
            } else if private && error.as_string().as_deref() == Some("signer-timeout") {
                "signer-timeout"
            } else {
                "signer-missing"
            }
        })?
        .as_string()
        .ok_or("signer-refused")?;
    let signed =
        lkjstr_protocol::parse_nostr_event_json(&raw, None).map_err(|_| "signer-refused")?;
    lkjstr_core::actions::validate_signed_event(&event, &signed).map_err(|_| "signer-refused")?;
    Ok(signed)
}
