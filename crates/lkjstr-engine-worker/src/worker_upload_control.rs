//! Upload cancellation consumes its lease before abort callbacks wake async work.
use super::*;
use lkjstr_core::engine::upload_jobs::{Jobs, Lease};
use web_sys::{AbortController, AbortSignal};
#[derive(Default)]
pub(in crate::worker) struct Control {
    jobs: Jobs,
    aborts: BTreeMap<Lease, (String, AbortController)>, // <=4 upload jobs
}
impl Control {
    pub(in crate::worker) fn pending(&self, client: u64, req: &str) -> bool {
        self.aborts
            .keys()
            .any(|lease| lease.client() == client && lease.request() == req)
    }
    pub(in crate::worker) fn begin(
        &mut self,
        client: u64,
        req: &str,
        account: &str,
    ) -> Result<(Lease, AbortSignal), &'static str> {
        let abort = AbortController::new().map_err(|_| "internal")?;
        let lease = self.jobs.begin(client, req)?;
        let signal = abort.signal();
        self.aborts
            .insert(lease.clone(), (account.to_owned(), abort));
        Ok((lease, signal))
    }
    pub(super) fn current(&self, lease: &Lease) -> bool {
        self.jobs.current(lease)
    }
    pub(super) fn finish(&mut self, lease: &Lease) -> bool {
        if !self.jobs.finish(lease) {
            return false;
        }
        self.aborts.remove(lease);
        true
    }
    fn cancel(&mut self, client: u64, req: &str) -> Option<Lease> {
        let lease = self.jobs.cancel(client, req)?;
        if let Some((_, abort)) = self.aborts.remove(&lease) {
            abort.abort();
        }
        Some(lease)
    }
}
fn end(h: &mut Host, client: u64, req: &str, reason: Option<&str>, notify: bool) {
    let Some(lease) = h.upload_control.cancel(client, req) else {
        return;
    };
    h.upload_tasks.retain(|task| task.lease != lease);
    h.upload_inflight = h.upload_inflight.saturating_sub(1);
    if notify && !h.stopped {
        let out = reason.map_or_else(
            || Session::cancelled(req.to_owned()),
            |code| Session::failure(req.to_owned(), code),
        );
        h.scope.direct(client, &out);
    }
}
pub(in crate::worker) fn cancel(h: &mut Host, client: u64, req: &str) {
    end(h, client, req, None, true);
}
pub(in crate::worker) fn detach(h: &mut Host, client: u64) {
    for lease in h
        .upload_control
        .jobs
        .leases()
        .into_iter()
        .filter(|l| l.client() == client)
    {
        end(h, client, lease.request(), None, false);
    }
}
pub(in crate::worker) fn stop(h: &mut Host) {
    for lease in h.upload_control.jobs.leases() {
        end(h, lease.client(), lease.request(), None, false);
    }
}
pub(in crate::worker) fn prune(h: &mut Host) {
    let stale: Vec<_> = h
        .upload_control
        .aborts
        .iter()
        .filter_map(|(lease, (account, _))| {
            if h.stopped || !h.sessions.contains_key(&lease.client()) {
                Some((lease.clone(), None, false))
            } else {
                h.accounts
                    .require_signer(account)
                    .err()
                    .map(|code| (lease.clone(), Some(code), true))
            }
        })
        .collect();
    for (lease, reason, notify) in stale {
        end(h, lease.client(), lease.request(), reason, notify);
    }
}
