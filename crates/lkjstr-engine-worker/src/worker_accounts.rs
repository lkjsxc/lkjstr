//! Commit account changes before exposing them; serialize mutations across ports.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session, actions::Action as A};
#[path = "worker_account_commit.rs"]
mod commit;
#[path = "worker_account_drafts.rs"]
mod draft_storage;
#[path = "worker_account_mutation.rs"]
mod mutation;
pub(super) use commit::pump_accounts;
pub(super) fn ready(h: &mut Host, id: u64, shared: bool) {
    private_lists::local_policy(h);
    h.scope.direct(id, &Session::ready(shared));
    send_accounts(h, id);
    h.scope.direct(id, &summary(h));
}
fn summary(h: &Host) -> W {
    W::Status {
        connected: h
            .engine
            .network
            .relays
            .values()
            .filter(|r| r.online)
            .count(),
        wanted: h.engine.network.relays.len(),
        offline: false,
    }
}
pub(super) fn status(host: &Rc<RefCell<Host>>) {
    let mut h = host.borrow_mut();
    if !h.loaded {
        return;
    }
    h.apply_relay_owner(false);
    private_lists::local_policy(&mut h);
    if h.account_revision != h.engine.store.revision() {
        h.account_revision = h.engine.store.revision();
        for id in h.sessions.keys() {
            send_accounts(&h, *id);
        }
    }
    let value = (
        h.engine
            .network
            .relays
            .values()
            .filter(|r| r.online)
            .count(),
        h.engine.network.relays.len(),
    );
    if h.status != Some(value) {
        h.status = Some(value);
        for id in h.sessions.keys() {
            h.scope.direct(*id, &summary(&h));
        }
    }
    let now = h.time();
    let expired = h
        .discovery
        .iter()
        .filter(|(_, at)| now >= **at)
        .map(|(k, _)| k.clone())
        .collect::<Vec<_>>();
    for (id, req) in expired {
        h.discovery.remove(&(id, req.clone()));
        h.scope.direct(id, &Session::failure(req, "signer-missing"));
    }
}
fn send_accounts(h: &Host, id: u64) {
    let accounts=h.accounts.entries.iter().map(|a|{
        let author=lkjstr_core::engine::rows::author(&h.engine.store,&a.pubkey);
        let mut value = serde_json::json!({"author":lkjstr_core::engine::wire::note::author(&author),"signer":a.signer,"encrypted":a.encrypted(),"locked":a.locked(),"unread":lkjstr_core::engine::wire::unread_count(&h.engine,&a.pubkey),"unreadZap":lkjstr_core::engine::wire::unread_zap_evidence(&h.engine,&a.pubkey)});
        value["privateLists"]=serde_json::json!(h.engine.private_reads.policy_status(&h.engine.store,&a.pubkey));
        if h.engine.store.replaceable(&a.pubkey, 10050).is_some() {
            value["inbox"] = serde_json::json!(lkjstr_core::engine::dm::routing::inboxes(&h.engine.store, &a.pubkey).unwrap_or_default());
        }
        value
    }).collect();
    h.scope.direct(
        id,
        &W::Accounts {
            accounts,
            active: h.accounts.active.clone(),
        },
    );
}
