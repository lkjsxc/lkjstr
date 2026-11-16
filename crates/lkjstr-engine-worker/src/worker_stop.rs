//! Permanent Host disposal. In-memory state only; durable storage is untouched.
use super::*;

pub(super) fn stop(h: &mut Host) {
    h.stopped = true;
    // Mute before revocation: abort callbacks and late effects cannot reply.
    h.scope.close();
    bunker::sync(h);
    zaps::stop(h);
    direct_messages::sync(h);
    private_lists::sync(h);
    uploads::control::stop(h);
    h.accounts = Default::default();
    h.account_tasks.clear();
    h.startup.clear();
    // The handle cannot resume. Drop private policy, core anchors, pending output
    // and per-client projections rather than retaining an unusable cache.
    h.engine = Engine::new();
    h.sessions.clear();
    h.loaded = false;
    h.timer.take();
    h.sockets.clear();
    if let Some(db) = h.db.take() {
        db.close();
    }
}
