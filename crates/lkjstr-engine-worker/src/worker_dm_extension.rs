//! Hand off private input synchronously, then await only correlation and cancellation state.
use super::*;
use lkjstr_core::engine::signer_orchestration::SignerWork;
pub(super) struct Pending {
    client: u64,
    req: String,
    promise: js_sys::Promise,
}
pub(super) fn begin(
    h: &mut Host,
    call: &Call<'_>,
    data: &str,
    lease: &dm::signers::Lease,
    ms: u32,
) -> Result<Pending, &'static str> {
    signers::check(h, lease)?;
    let req = format!(
        "dm-crypto-{}",
        lkjstr_nips::hex(&crate::browser::random_bytes::<16>()?)
    );
    let background = call.read.is_some() && h.dm.passive_read(call.account);
    let work = match (call.list.is_some(), call.read.is_some(), background) {
        (true, _, _) => SignerWork::LazyList,
        (_, true, true) => SignerWork::Background,
        (_, true, false) => SignerWork::Visible,
        _ => SignerWork::UserAction,
    };
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        h.dm.crypto
            .insert((call.client, req.clone()), (lease.clone(), resolve));
        h.scope.direct(
            call.client,
            &W::Crypt {
                req: req.clone(),
                expires_at: Some(crate::measure::epoch_now() + u64::from(ms)),
                pubkey: call.account.into(),
                peer: call.peer.into(),
                operation: call.operation.into(),
                data: data.into(),
                background,
                weight: work.weight(),
                context: call.list.map(|job| {
                    lkjstr_core::engine::wire::CryptContext::PrivateList {
                        sub: job.sub.clone(),
                        event: job.event.clone(),
                    }
                }),
            },
        );
    });
    Ok(Pending {
        client: call.client,
        req,
        promise,
    })
}
pub(super) async fn finish(
    host: &Rc<RefCell<Host>>,
    pending: Pending,
    signal: &web_sys::AbortSignal,
    ms: u32,
) -> Result<String, &'static str> {
    let reply = crate::browser::promise::bounded_ms_for(
        pending.promise,
        ms,
        "signer-timeout",
        || {},
        Some(signal),
    )
    .await;
    host.borrow_mut()
        .dm
        .crypto
        .remove(&(pending.client, pending.req));
    let reply = reply.map_err(|error| match error.as_string().as_deref() {
        Some("signer-timeout") => "signer-timeout",
        Some(crate::browser::abort::CANCELLED) => "offline",
        _ => "signer-missing",
    })?;
    if let Ok(code) = js_sys::Reflect::get(&reply, &"error".into())
        && let Some(code) = code.as_string()
    {
        return Err(match code.as_str() {
            "unsupported" => "unsupported",
            "signer-missing" => "signer-missing",
            "signer-timeout" => "signer-timeout",
            "rate-limited" => "rate-limited",
            "offline" => "offline",
            _ => "signer-refused",
        });
    }
    reply.as_string().ok_or("signer-refused")
}
