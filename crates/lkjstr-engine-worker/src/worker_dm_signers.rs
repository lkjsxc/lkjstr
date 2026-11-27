//! Private signer effects share a bounded gate and owned abort controllers.
use super::*;
use dm::signers::{Failure, Gate, Lease, Read};
use lkjstr_core::engine::accounts::secret::SecretText;
use web_sys::{AbortController, AbortSignal};
#[derive(Default)]
pub(in crate::worker) struct Book {
    pub(in crate::worker) gate: Gate,
    calls: BTreeMap<Lease, Flight>, // <=8; includes queued external calls
}
struct Flight {
    input: Option<SecretText>,
    abort: AbortController,
    ready: Option<js_sys::Function>,
}
pub(in crate::worker) struct Pending {
    pub lease: Lease,
    pub signal: AbortSignal,
    pub ready: js_sys::Promise,
}
pub(in crate::worker) fn sync(h: &mut Host) {
    let before = h.dm.signers.gate.reads();
    let clients: BTreeSet<_> = h.sessions.keys().copied().collect();
    let available = if h.stopped {
        BTreeMap::new()
    } else {
        h.dm.access
            .iter()
            .filter(|(_, (ok, _))| *ok)
            .map(|(account, (_, epoch))| {
                let visible = h.dm.views.iter().any(|((client, _), view)| {
                    view.query.account == *account
                        && view.visible
                        && !h.dm.hidden.contains(client)
                        && clients.contains(client)
                });
                (account.clone(), (*epoch, visible))
            })
            .collect()
    };
    h.dm.signers.gate.sync(&available, &clients);
    reconcile(h, before);
}
pub(in crate::worker) fn retry(h: &mut Host, account: &str) {
    let before = h.dm.signers.gate.reads();
    h.dm.signers.gate.retry(account);
    reconcile(h, before);
    h.dm.last_scan = u64::MAX;
    h.dm.next_emit = 0;
}
fn reconcile(h: &mut Host, before: Vec<Read>) {
    for read in before {
        if !h.dm.signers.gate.current_read(&read) {
            h.dm.attempted
                .remove(&(read.account().into(), read.event().into()));
            h.dm.last_scan = u64::MAX;
        }
    }
    let stale: Vec<_> =
        h.dm.signers
            .calls
            .keys()
            .filter(|lease| !h.dm.signers.gate.current(lease))
            .cloned()
            .collect();
    for lease in stale {
        if let Some(call) = h.dm.signers.calls.remove(&lease) {
            call.abort.abort();
        }
    }
    let stale: Vec<_> =
        h.dm.crypto
            .iter()
            .filter(|(_, (lease, _))| !h.dm.signers.gate.current(lease))
            .map(|(key, _)| key.clone())
            .collect();
    for key in stale {
        if let Some((_, resolve)) = h.dm.crypto.remove(&key) {
            if !h.stopped {
                h.scope
                    .direct(key.0, &W::CryptCancel { req: key.1.clone() });
            }
            let error = serde::Serialize::serialize(
                &serde_json::json!({"error":"offline"}),
                &serde_wasm_bindgen::Serializer::json_compatible(),
            )
            .unwrap_or(JsValue::NULL);
            let _ = resolve.call1(&JsValue::NULL, &error);
        }
    }
    h.dm.errors.clear();
    for account in h.dm.access.keys() {
        if let Some(failure) = h.dm.signers.gate.failure(account) {
            h.dm.errors.insert(account.clone(), failure.code().into());
        }
    }
    let active = h.dm.active();
    h.dm.queue.retain(|key| {
        if active.contains(&key.0) {
            true
        } else {
            h.dm.attempted.remove(key);
            false
        }
    });
    wake(h);
}
fn wake(h: &mut Host) {
    for lease in h.dm.signers.gate.start() {
        if let Some(call) = h.dm.signers.calls.get_mut(&lease)
            && let Some(resolve) = call.ready.take()
        {
            let _ = resolve.call0(&JsValue::NULL);
        }
    }
}
pub(in crate::worker) fn begin(
    h: &mut Host,
    client: u64,
    account: &str,
    epoch: u64,
    read: Option<&Read>,
    data: SecretText,
) -> Result<Pending, &'static str> {
    begin_for(h, client, account, epoch, read, data, false)
}
pub(in crate::worker) fn begin_list(
    h: &mut Host,
    client: u64,
    account: &str,
    epoch: u64,
    data: SecretText,
) -> Result<Pending, &'static str> {
    begin_for(h, client, account, epoch, None, data, true)
}
fn begin_for(
    h: &mut Host,
    client: u64,
    account: &str,
    epoch: u64,
    read: Option<&Read>,
    data: SecretText,
    list: bool,
) -> Result<Pending, &'static str> {
    sync(h);
    lifetime::check(h, client, account, epoch)?;
    let abort = AbortController::new().map_err(|_| "internal")?;
    let lease = if list {
        h.dm.signers.gate.begin_list(account, client, epoch)?
    } else {
        h.dm.signers.gate.begin(account, client, epoch, read)?
    };
    let signal = abort.signal();
    let mut data = Some(data);
    let ready = js_sys::Promise::new(&mut |resolve, _| {
        h.dm.signers.calls.insert(
            lease.clone(),
            Flight {
                input: data.take(),
                abort: abort.clone(),
                ready: Some(resolve),
            },
        );
    });
    wake(h);
    Ok(Pending {
        lease,
        signal,
        ready,
    })
}
pub(in crate::worker) fn take_input(
    h: &mut Host,
    lease: &Lease,
) -> Result<SecretText, &'static str> {
    check(h, lease)?;
    h.dm.signers
        .calls
        .get_mut(lease)
        .and_then(|call| call.input.take())
        .ok_or("offline")
}
pub(in crate::worker) fn check(h: &Host, lease: &Lease) -> Result<(), &'static str> {
    lifetime::check(h, lease.client(), lease.account(), lease.epoch())?;
    if h.dm.signers.gate.current(lease) {
        Ok(())
    } else {
        if lease.is_list() {
            return Err("offline");
        }
        Err(h
            .dm
            .signers
            .gate
            .failure(lease.account())
            .map_or("offline", Failure::code))
    }
}
pub(in crate::worker) fn check_read(h: &Host, read: &Read) -> Result<(), &'static str> {
    lifetime::check(h, read.client(), read.account(), read.epoch())?;
    if h.dm.signers.gate.current_read(read) {
        Ok(())
    } else {
        Err("offline")
    }
}
pub(in crate::worker) fn finish(
    h: &mut Host,
    lease: &Lease,
    outcome: Result<String, &'static str>,
    asked: bool,
) -> Result<String, &'static str> {
    if let Err(code) = check(h, lease) {
        let before = h.dm.signers.gate.reads();
        h.dm.signers.gate.finish(lease);
        reconcile(h, before);
        if let Ok(text) = outcome {
            drop(lkjstr_core::engine::accounts::secret::SecretText::new(text));
        }
        return Err(code);
    }
    let before = h.dm.signers.gate.reads();
    if !lease.is_list()
        && let Err(code) = outcome.as_ref()
        && let Some(failure) = Failure::from_code(code).filter(|f| asked || *f == Failure::Missing)
    {
        h.dm.signers.gate.pause(lease, failure);
    } else {
        h.dm.signers.gate.finish(lease);
    }
    reconcile(h, before);
    h.dm.next_emit = 0;
    outcome
}

pub(in crate::worker) fn cancel_list(h: &mut Host, lease: &Lease) {
    if !lease.is_list() {
        return;
    }
    let before = h.dm.signers.gate.reads();
    h.dm.signers.gate.finish(lease);
    reconcile(h, before);
}
