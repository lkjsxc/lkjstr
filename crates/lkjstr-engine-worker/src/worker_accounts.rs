//! Commit account changes before exposing them; serialize mutations across ports.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session, actions::Action as A};
#[path = "worker_account_drafts.rs"]
mod draft_storage;
#[path = "worker_account_mutation.rs"]
mod mutation;
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
pub(super) fn pump_accounts(host: &Rc<RefCell<Host>>) {
    let task = {
        let mut h = host.borrow_mut();
        if h.account_busy || h.account_tasks.is_empty() {
            return;
        }
        h.account_busy = true;
        let task = h.account_tasks.remove(0);
        let watermark = if let A::Seen { account } = &task.2 {
            Some(lkjstr_core::engine::wire::notification_read_mark(
                &h.engine, account,
            ))
        } else {
            None
        };
        (task, h.accounts.clone(), h.db.clone(), watermark)
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let ((id, req, action), mut next, db, watermark) = task;
        let refresh = matches!(
            &action,
            A::AccountAdd { .. }
                | A::AccountUse { .. }
                | A::AccountImportEncrypted { .. }
                | A::AccountUnlock { .. }
        );
        let removed = match &action {
            A::AccountRemove { pubkey } => Some(pubkey.clone()),
            _ => None,
        };
        let lock = if let A::AccountLock { pubkey } = &action {
            if let Some(host) = weak.upgrade() {
                Some(direct_messages::editors::prepare(&host, pubkey).await)
            } else {
                return;
            }
        } else {
            None
        };
        let zap_change = zaps::account_change(&action);
        let caller = bunker::Caller {
            host: weak.clone(),
            client: id,
            req: req.clone(),
        };
        let result = match &lock {
            Some(Err(code)) => Err(*code),
            _ => mutation::apply(action, &mut next, watermark, &caller).await,
        };
        let result = match (result, db) {
            (Ok(exported), Some(db)) => match serde_json::to_string(&next) {
                Ok(saved) => draft_storage::commit(&db, saved, removed.as_deref())
                    .await
                    .map(|_| exported),
                Err(_) => Err("internal"),
            },
            (Err(e), _) => Err(e),
            _ => Err("internal"),
        };
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            h.account_busy = false;
            if h.stopped {
                return;
            }
            match result {
                Ok(exported) => {
                    let private_revoked = private_cache::decreased(&h.accounts, &next);
                    h.accounts = next;
                    bunker::sync(&mut h);
                    zaps::committed(&mut h, zap_change);
                    relay_auth::sync(&mut h);
                    direct_messages::sync(&mut h);
                    private_lists::local_policy(&mut h);
                    uploads::control::prune(&mut h);
                    h.engine.seen = h.accounts.seen.clone();
                    h.engine.notification_ties = h.accounts.notification_ties.clone();
                    h.engine.notification_zaps = h.accounts.notification_zaps.clone();
                    private_cache::revoke(&mut h, private_revoked);
                    h.account_revision = u64::MAX;
                    h.engine.invalidate();
                    h.apply_relay_owner(false);
                    if refresh && let Some(account) = h.accounts.active.clone() {
                        let at = h.time();
                        h.engine.refresh_account(&account, at);
                    }
                    for id in h.sessions.keys() {
                        send_accounts(&h, *id);
                    }
                    h.scope.direct(
                        id,
                        &W::Result {
                            req,
                            ok: true,
                            error: None,
                            delivery: None,
                            id: None,
                            uploaded: None,
                            key: None,
                            encrypted_key: exported,
                            zap_intent: None,
                            dm_draft: None,
                            dm_draft_revision: None,
                            dm_delivery: None,
                            cancelled: None,
                        },
                    );
                }
                Err(code) => h.scope.direct(id, &Session::failure(req, code)),
            }
            if let Some(Ok(ticket)) = lock {
                direct_messages::editors::finish(&mut h, &ticket.req);
            }
        }
    });
}
