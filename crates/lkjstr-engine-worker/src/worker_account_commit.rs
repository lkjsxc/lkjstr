//! Serialize account operations and expose only transaction-confirmed snapshots.
use super::*;
use lkjstr_core::engine::{account_storage::Failure, accounts::secret::SecretText};
pub(in crate::worker) fn pump_accounts(host: &Rc<RefCell<Host>>) {
    let task = {
        let mut h = host.borrow_mut();
        if h.account_busy || h.account_tasks.is_empty() {
            return;
        }
        let task = h.account_tasks.remove(0);
        if !h.sessions.contains_key(&task.0) {
            return;
        }
        let expected = match h.account_store.state.expected() {
            Ok(value) => value,
            Err(failure) => {
                h.scope
                    .direct(task.0, &Session::failure(task.1, failure.code()));
                return;
            }
        };
        let controller = match web_sys::AbortController::new() {
            Ok(value) => value,
            Err(_) => {
                h.scope
                    .direct(task.0, &Session::failure(task.1, "internal"));
                return;
            }
        };
        let signal = controller.signal();
        h.account_store.committing = Some((task.0, controller));
        h.account_busy = true;
        let watermark = if let A::Seen { account } = &task.2 {
            Some(lkjstr_core::engine::wire::notification_read_mark(
                &h.engine, account,
            ))
        } else {
            None
        };
        (
            task,
            h.accounts.clone(),
            h.db.clone(),
            watermark,
            expected,
            signal,
        )
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let ((id, req, action), mut next, db, watermark, expected, signal) = task;
        let raw_backup = matches!(&action, A::AccountKey { .. });
        let write = !matches!(
            &action,
            A::AccountKey { .. }
                | A::AccountExportEncrypted { .. }
                | A::AccountLock { .. }
                | A::AccountUnlock { .. }
        );
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
        // A backup remains redacted/zeroizing until its exact live success reply.
        let result = result.map(|value| value.map(SecretText::new));
        let mut storage_failure = None;
        let result = match (result, db) {
            (Ok(exported), Some(db)) if !signal.aborted() => {
                let saved = if write {
                    serde_json::to_string(&next).map(SecretText::new).map(Some)
                } else {
                    Ok(None)
                };
                match saved {
                    Ok(saved) => match draft_storage::commit(
                        &db,
                        expected,
                        saved,
                        removed.as_deref(),
                        &signal,
                    )
                    .await
                    {
                        Ok(revision) => Ok((exported, revision)),
                        Err(failure) => {
                            storage_failure = Some(failure);
                            Err(failure.code())
                        }
                    },
                    Err(_) => Err("internal"),
                }
            }
            (Err(e), _) => Err(e),
            _ => Err("internal"),
        };
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            h.account_busy = false;
            h.account_store.committing = None;
            if h.stopped {
                return;
            }
            if let Some(failure) = storage_failure {
                h.account_store.state.rejected(expected, failure);
            }
            let result = result.and_then(|(exported, revision)| {
                h.account_store
                    .state
                    .committed(expected, revision)
                    .map_err(Failure::code)?;
                Ok(exported)
            });
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
                    if h.sessions.contains_key(&id) {
                        let exported = exported.map(|value| value.to_string());
                        let (key, encrypted_key) = if raw_backup {
                            (exported, None)
                        } else {
                            (None, exported)
                        };
                        h.scope.direct(
                            id,
                            &W::Result {
                                req,
                                ok: true,
                                error: None,
                                delivery: None,
                                id: None,
                                uploaded: None,
                                key,
                                encrypted_key,
                                zap_intent: None,
                                dm_draft: None,
                                dm_draft_revision: None,
                                dm_delivery: None,
                                cancelled: None,
                            },
                        );
                    }
                }
                Err(code) => h.scope.direct(id, &Session::failure(req, code)),
            }
            if let Some(Ok(ticket)) = lock {
                direct_messages::editors::finish(&mut h, &ticket.req);
            }
        }
    });
}
