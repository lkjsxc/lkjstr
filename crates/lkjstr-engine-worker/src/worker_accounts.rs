//! Commit account changes before exposing them; serialize mutations across ports.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session, actions::Action as A};
pub(super) fn ready(h: &Host, id: u64, shared: bool) {
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
    if h.account_revision != h.engine.store.revision() {
        h.account_revision = h.engine.store.revision();
        let lists = h
            .accounts
            .entries
            .iter()
            .flat_map(|a| {
                h.engine.store.feed(&lkjstr_core::store::Query {
                    authors: Some([a.pubkey.clone()].into_iter().collect()),
                    kinds: vec![10000, 10003, 30000],
                    limit: 128,
                    ..Default::default()
                })
            })
            .take(128)
            .collect::<Vec<_>>();
        let mut private = BTreeMap::new();
        for list in lists {
            if let Some(entries) = h.accounts.private_entries(&list) {
                private.insert(list.id.clone(), entries);
            }
        }
        if private != h.engine.private_lists {
            h.engine.private_lists = private;
            h.engine.invalidate();
        }
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
        serde_json::json!({"author":{"pubkey":author.pubkey,"npub":lkjstr_protocol::encode_npub(&author.pubkey).unwrap_or_default(),"name":author.name},"signer":a.signer,"unread":lkjstr_core::engine::query::events(&h.engine.store,&lkjstr_core::engine::protocol::Query {source:lkjstr_core::engine::protocol::Source::Notifications,account:Some(a.pubkey.clone()),..Default::default()}).iter().filter(|e|e.pubkey!=a.pubkey && e.created_at.saturating_mul(1000)>h.accounts.seen.get(&a.pubkey).copied().unwrap_or(0)).count()})
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
        (task, h.accounts.clone(), h.db.clone())
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let ((id, req, action), mut next, db) = task;
        let refresh = matches!(&action, A::AccountAdd { .. } | A::AccountUse { .. });
        let result = match action {
            A::AccountAdd { how, key } => {
                if how == "key" && key.as_deref().is_some_and(|v| v.starts_with("bunker://")) {
                    match lkjstr_protocol::remote::Remote::parse(key.as_deref().unwrap_or("")) {
                        Some((session, token)) => {
                            let connect = crate::browser::remote::rpc(
                                &session,
                                "connect",
                                vec![session.peer.clone(), token.unwrap_or_default()],
                            )
                            .await;
                            if connect.is_ok() {
                                match crate::browser::remote::rpc(
                                    &session,
                                    "get_public_key",
                                    vec![],
                                )
                                .await
                                {
                                    Ok(pubkey) => next.add_remote(pubkey, session),
                                    Err(code) => Err(code),
                                }
                            } else {
                                Err(connect.err().unwrap_or("signer-refused"))
                            }
                        }
                        None => Err("rejected"),
                    }
                } else {
                    next.add(&how, key.as_deref())
                }
            }
            A::AccountUse { pubkey } => next.use_account(&pubkey),
            A::AccountRemove { pubkey } => next.remove(&pubkey),
            A::Seen { account } => {
                if next.entries.iter().any(|a| a.pubkey == account) {
                    next.seen.insert(account, now());
                    Ok(())
                } else {
                    Err("signed-out")
                }
            }
            A::ChannelSeen { account, id } => {
                if !lkjstr_protocol::is_event_id(&id) {
                    Err("rejected")
                } else if next.entries.iter().any(|a| a.pubkey == account) {
                    let key = format!("channel:{account}:{id}");
                    if next.seen.len() >= 4096 && !next.seen.contains_key(&key) {
                        Err("too-large")
                    } else {
                        next.seen.insert(key, now());
                        Ok(())
                    }
                } else {
                    Err("signed-out")
                }
            }
            _ => Err("unsupported"),
        };
        let result = match (result, db) {
            (Ok(()), Some(db)) => match serde_json::to_string(&next) {
                Ok(saved) => idb::kv_put(&db, "engine-accounts", &saved)
                    .await
                    .map_err(|_| "internal"),
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
                Ok(()) => {
                    h.accounts = next;
                    h.engine.seen = h.accounts.seen.clone();
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
                        },
                    );
                }
                Err(code) => h.scope.direct(id, &Session::failure(req, code)),
            }
        }
    });
}
