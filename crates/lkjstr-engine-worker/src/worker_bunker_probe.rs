//! Harness-only scheduling of one public Sign; no arbitrary credential/state input.
use super::*;
use wasm_bindgen_futures::JsFuture;

#[derive(Default)]
pub(super) struct Queue {
    armed: Option<(String, u64)>,
    waiting: Option<Waiting>,
}
struct Waiting {
    client: u64,
    account: String,
    deadline: u64,
    resolve: js_sys::Function,
}
pub(in crate::worker) fn arm(h: &mut Host, account: &str) -> bool {
    if h.stopped
        || authority(h, account).is_none()
        || h.bunker.probe.armed.is_some()
        || h.bunker.probe.waiting.is_some()
    {
        return false;
    }
    h.bunker.probe.armed = Some((account.into(), h.time().saturating_add(60_000)));
    true
}
pub(in crate::worker) fn queued(h: &Host) -> bool {
    h.bunker.probe.waiting.is_some()
}
pub(in crate::worker) fn release(h: &mut Host) -> bool {
    let Some(waiting) = h.bunker.probe.waiting.take() else {
        return false;
    };
    let _ = waiting.resolve.call0(&JsValue::NULL);
    true
}
pub(in crate::worker) fn sync(h: &mut Host) {
    if h.bunker
        .probe
        .armed
        .as_ref()
        .is_some_and(|(_, deadline)| h.stopped || h.time() >= *deadline)
    {
        h.bunker.probe.armed = None;
    }
    if h.bunker.probe.waiting.as_ref().is_some_and(|job| {
        h.stopped || !h.sessions.contains_key(&job.client) || h.time() >= job.deadline
    }) {
        release(h);
    }
}
pub(in crate::worker) async fn wait(
    host: &Rc<RefCell<Host>>,
    client: u64,
    account: &str,
    deadline: u64,
) {
    let held = {
        let mut h = host.borrow_mut();
        sync(&mut h);
        let held = h
            .bunker
            .probe
            .armed
            .as_ref()
            .is_some_and(|(key, _)| key == account);
        if held {
            h.bunker.probe.armed = None;
        }
        held
    };
    if !held {
        return;
    }
    let pending = js_sys::Promise::new(&mut |resolve, _| {
        host.borrow_mut().bunker.probe.waiting = Some(Waiting {
            client,
            account: account.into(),
            deadline,
            resolve,
        });
    });
    let _ = JsFuture::from(pending).await;
}
/// Exact normal replacement policy, retaining all Remote bytes solely inside Rust.
pub(in crate::worker) fn renew(h: &mut Host, account: &str) -> bool {
    if h.stopped
        || !h
            .bunker
            .probe
            .waiting
            .as_ref()
            .is_some_and(|job| job.account == account)
    {
        return false;
    }
    let Some(before) = authority(h, account) else {
        return false;
    };
    let Some(remote) = h.accounts.remote(account) else {
        return false;
    };
    if h.accounts.add_remote(account.into(), remote).is_err() {
        return false;
    }
    super::sync(h);
    authority(h, account).is_some_and(|after| {
        before.generation != after.generation
            && before.peer == after.peer
            && before.client == after.client
    })
}
