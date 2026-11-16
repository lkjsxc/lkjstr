//! Worker-coordinated private-editor flush before a shared account lock commits.
use super::*;
use lkjstr_core::engine::dm::editors::{Editors, PREPARE_MS, Ticket};
use lkjstr_core::engine::wire::actions::Action as A;
#[derive(Default)]
pub(super) struct Book {
    policy: Editors,
    account: Option<String>,   // belongs to the one pending/committing lock
    namespace: Option<String>, // random per Worker; counter reuse cannot release a new attempt
    waiting: Option<(String, js_sys::Function, Option<u64>)>, // one serialized account mutation
}
pub(super) fn input(h: &mut Host, client: u64, message: &I) -> bool {
    match message {
        I::Act {
            req,
            action:
                A::DmEditor {
                    account,
                    editor,
                    open,
                    dirty,
                },
        } => {
            let outcome = if *open {
                h.accounts
                    .require_signer(account)
                    .map(|_| ())
                    .and_then(|_| {
                        h.dm.editors
                            .policy
                            .register(client, account, editor, *dirty)
                    })
            } else {
                h.dm.editors.policy.unregister(client, account, editor);
                Ok(())
            };
            h.scope
                .direct(client, &result(req.clone(), outcome.err(), None));
            settle(h);
            true
        }
        I::DmFlushed { req, ok } => {
            h.dm.editors.policy.answer(client, req, *ok);
            settle(h);
            true
        }
        _ => false,
    }
}
pub(super) fn sync(h: &mut Host) {
    let accounts = if h.stopped {
        BTreeSet::new()
    } else {
        h.accounts
            .entries
            .iter()
            .filter(|a| h.accounts.require_signer(&a.pubkey).is_ok())
            .map(|a| a.pubkey.clone())
            .collect()
    };
    let clients = h.sessions.keys().copied().collect();
    h.dm.editors.policy.retain(&accounts, &clients);
    settle(h);
}
pub(crate) fn detach(h: &mut Host, client: u64) {
    h.dm.editors.policy.detach(client);
    settle(h);
}
pub(crate) fn expire(h: &mut Host, client: u64) {
    h.dm.editors.policy.expire(client);
    settle(h);
}
fn settle(h: &mut Host) {
    let Some((req, _, _)) = &h.dm.editors.waiting else {
        return;
    };
    let req = req.clone();
    let at = h.time();
    let Some(ok) = h.dm.editors.policy.decision(&req, at) else {
        if let Some(client) = h.dm.editors.policy.next(&req)
            && let Some((_, _, active)) = &mut h.dm.editors.waiting
            && *active != Some(client)
        {
            *active = Some(client);
            let account = h.dm.editors.account.clone();
            if let Some(account) = account {
                h.scope.direct(
                    client,
                    &W::DmFlush {
                        req,
                        account,
                        phase: "prepare".into(),
                    },
                );
            }
        }
        return;
    };
    if let Some((_, resolve, _)) = h.dm.editors.waiting.take() {
        let _ = resolve.call1(&JsValue::NULL, &JsValue::from_bool(ok));
    }
}
pub(crate) async fn prepare(
    host: &Rc<RefCell<Host>>,
    account: &str,
) -> Result<Ticket, &'static str> {
    let ticket = {
        let mut h = host.borrow_mut();
        if h.stopped {
            return Err("internal");
        }
        let at = h.time();
        h.dm.editors.account = Some(account.into());
        let namespace = if let Some(value) = &h.dm.editors.namespace {
            value.clone()
        } else {
            let bytes: [u8; 16] = crate::browser::random_bytes()?;
            let value: String = bytes.iter().map(|v| format!("{v:02x}")).collect();
            h.dm.editors.namespace = Some(value.clone());
            value
        };
        h.dm.editors.policy.begin(account, at, &namespace)?
    };
    let wait = js_sys::Promise::new(&mut |resolve, _| {
        let mut h = host.borrow_mut();
        h.dm.editors.waiting = Some((ticket.req.clone(), resolve, None));
        for client in &ticket.clients {
            h.scope.direct(
                *client,
                &W::DmFlush {
                    req: ticket.req.clone(),
                    account: ticket.account.clone(),
                    phase: "hold".into(),
                },
            );
        }
        settle(&mut h);
    });
    let ready = crate::browser::promise::bounded_ms(wait, PREPARE_MS as u32, "internal", || {})
        .await
        .ok()
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if ready && !host.borrow().stopped {
        Ok(ticket)
    } else {
        finish(&mut host.borrow_mut(), &ticket.req);
        Err("internal")
    }
}
pub(crate) fn finish(h: &mut Host, req: &str) {
    if h.dm
        .editors
        .waiting
        .as_ref()
        .is_some_and(|(pending, _, _)| pending == req)
        && let Some((_, resolve, _)) = h.dm.editors.waiting.take()
    {
        let _ = resolve.call1(&JsValue::NULL, &JsValue::FALSE);
    }
    if let Some(ticket) = h.dm.editors.policy.finish(req) {
        h.dm.editors.account = None;
        for client in ticket.clients {
            h.scope.direct(
                client,
                &W::DmFlush {
                    req: ticket.req.clone(),
                    account: ticket.account.clone(),
                    phase: "release".into(),
                },
            );
        }
    }
}
