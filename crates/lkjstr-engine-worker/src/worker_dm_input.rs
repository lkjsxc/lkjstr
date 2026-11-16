//! Private wire commands never enter the public query/row adapter.
use super::*;
use lkjstr_core::engine::wire::actions::Action as A;
pub(super) fn input(h: &mut Host, id: u64, input: &I) -> bool {
    match input {
        I::DmOpen {
            sub,
            query,
            visible,
        } => {
            let error = h
                .accounts
                .require_signer(&query.account)
                .err()
                .or_else(|| {
                    (!lkjstr_protocol::is_pubkey(&query.account)
                        || query
                            .conversation
                            .as_deref()
                            .is_some_and(|c| !lkjstr_protocol::is_event_id(c))
                        || query
                            .before
                            .as_deref()
                            .is_some_and(|c| !lkjstr_protocol::is_event_id(c)))
                    .then_some("rejected")
                })
                .or_else(|| {
                    (h.dm.views.len() >= 32 && !h.dm.views.contains_key(&(id, sub.clone())))
                        .then_some("too-large")
                });
            if let Some(code) = error {
                h.scope.direct(
                    id,
                    &W::Dm {
                        sub: sub.clone(),
                        snapshot: h
                            .dm
                            .inbox
                            .snapshot(query, "failed", Some(code.into()), false),
                    },
                );
                return true;
            }
            if h.dm.marks_error.is_some() {
                h.dm.marks_started = false;
                h.dm.marks_ready = false;
                h.dm.marks_error = None;
            }
            h.dm.errors.remove(&query.account);
            h.dm.views.insert(
                (id, sub.clone()),
                View {
                    query: query.clone(),
                    visible: visible.unwrap_or(true),
                    last: None,
                },
            );
            h.dm.last_scan = u64::MAX;
            true
        }
        I::DmClose { sub } => {
            h.dm.views.remove(&(id, sub.clone()));
            true
        }
        I::DmVisible { sub, visible } => {
            if let Some(v) = h.dm.views.get_mut(&(id, sub.clone())) {
                v.visible = *visible;
                v.last = None;
            }
            h.dm.last_scan = u64::MAX;
            true
        }
        I::DmMore { sub } => {
            if let Some(v) = h.dm.views.get(&(id, sub.clone())) {
                let account = v.query.account.clone();
                h.engine.dm_older(&account, &mut h.dm.cursors);
            }
            true
        }
        I::Crypted { req, value, error } => {
            if let Some((_, resolve)) = h.dm.crypto.remove(&(id, req.clone())) {
                let data = if let Some(code) = error {
                    serde_wasm_bindgen::to_value(&serde_json::json!({"error":code}))
                        .unwrap_or(JsValue::NULL)
                } else {
                    value
                        .as_ref()
                        .map(|s| JsValue::from_str(s))
                        .unwrap_or(JsValue::NULL)
                };
                let _ = resolve.call1(&JsValue::NULL, &data);
            }
            true
        }
        I::Hint { hint } => {
            if hint.page_hidden {
                h.dm.hidden.insert(id);
            } else {
                h.dm.hidden.remove(&id);
            }
            false
        }
        I::Detach => {
            h.dm.views.retain(|(client, _), _| *client != id);
            h.dm.hidden.remove(&id);
            false
        }
        I::Act {
            req,
            action: A::DmSend { account, draft },
        } => enqueue(
            h,
            id,
            req,
            account,
            Task::Send {
                client: id,
                req: req.clone(),
                account: account.clone(),
                draft: draft.clone(),
            },
        ),
        I::Act {
            req,
            action: A::DmSeen {
                account,
                conversation,
            },
        } => enqueue(
            h,
            id,
            req,
            account,
            Task::Seen {
                client: id,
                req: req.clone(),
                account: account.clone(),
                conversation: conversation.clone(),
            },
        ),
        I::Act {
            req,
            action: A::DmRelaysSave { account, relays },
        } => enqueue(
            h,
            id,
            req,
            account,
            Task::Relays {
                client: id,
                req: req.clone(),
                account: account.clone(),
                relays: relays.clone(),
            },
        ),
        _ => false,
    }
}
fn enqueue(h: &mut Host, id: u64, req: &str, account: &str, task: Task) -> bool {
    lifetime::sync(h);
    let error = h
        .accounts
        .require_signer(account)
        .err()
        .or_else(|| (h.dm.running + h.dm.tasks.len() >= 4).then_some("too-large"));
    if let Some(code) = error {
        h.scope.direct(id, &Session::failure(req.into(), code));
    } else {
        match lifetime::lease(h, id, account) {
            Ok(epoch) => h.dm.tasks.push((task, epoch)),
            Err(code) => h.scope.direct(id, &Session::failure(req.into(), code)),
        }
    }
    true
}
