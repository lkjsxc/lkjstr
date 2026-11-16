//! Register the upload lease before exposing work to the asynchronous pump.
use super::*;
use lkjstr_core::engine::wire::actions::Action;
pub(in crate::worker) fn enqueue(h: &mut Host, id: u64, req: String, action: Action) {
    let Action::Upload {
        account,
        name,
        mime,
        bytes,
        server,
    } = action
    else {
        return;
    };
    if h.upload_control.pending(id, &req) {
        return;
    }
    if h.upload_inflight >= 4 {
        h.scope.direct(id, &Session::failure(req, "too-large"));
        return;
    }
    let (lease, signal) = match h.upload_control.begin(id, &req, &account) {
        Ok(value) => value,
        Err(code) => {
            h.scope.direct(id, &Session::failure(req, code));
            return;
        }
    };
    h.upload_tasks.push(Task {
        deadline: Deadline::new(clock()),
        id,
        req,
        account,
        name,
        mime,
        bytes,
        server,
        lease,
        signal,
    });
    h.upload_inflight += 1;
}
