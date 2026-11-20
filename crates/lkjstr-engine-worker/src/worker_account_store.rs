//! Owned account storage lifetimes. Conflicts do not reconcile session authority.
use super::*;
use lkjstr_core::engine::account_storage;
#[derive(Default)]
pub(super) struct State {
    pub state: account_storage::State,
    pub opening: Option<web_sys::AbortController>,
    pub committing: Option<(u64, web_sys::AbortController)>,
}
pub(super) fn stop(h: &mut Host) {
    if let Some(controller) = h.account_store.opening.take() {
        controller.abort();
    }
    if let Some((_, controller)) = h.account_store.committing.take() {
        controller.abort();
    }
}
pub(super) fn detach(h: &mut Host, client: u64) {
    h.account_tasks.retain(|(id, _, _)| *id != client);
    h.startup.retain(|(id, _, _)| *id != client);
    if h.account_store
        .committing
        .as_ref()
        .is_some_and(|(id, _)| *id == client)
        && let Some((_, controller)) = h.account_store.committing.take()
    {
        controller.abort();
    }
}
