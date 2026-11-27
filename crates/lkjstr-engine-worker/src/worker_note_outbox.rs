//! Commit exact signed bodies before any publication frame.
use super::*;
use crate::browser::idb_accounts::{self, Change};
use lkjstr_core::engine::{
    accounts::Accounts,
    network::note_outbox::{storage_key, valid_key},
    wire::{Input as W, Session, actions::Action},
};

#[derive(Default)]
pub(super) struct Writer {
    busy: bool,
    next: u64,
}

pub(super) async fn read(
    db: &web_sys::IdbDatabase,
    accounts: &Accounts,
    signal: &web_sys::AbortSignal,
) -> Result<Vec<(String, String)>, String> {
    let mut rows = vec![];
    let mut bytes = 0;
    for entry in &accounts.entries {
        if signal.aborted() {
            return Err("outbox load stopped".into());
        }
        if let Some(raw) = idb::kv_get(db, &storage_key(&entry.pubkey)).await? {
            bytes += raw.len();
            if bytes > 32 * 1024 * 1024 {
                return Err("outbox load exceeded bound".into());
            }
            rows.push((entry.pubkey.clone(), raw));
        }
    }
    Ok(rows)
}

fn publish(input: &W) -> Option<(&str, &str, &str)> {
    use lkjstr_core::engine::wire::actions::Publish;
    let W::Act {
        req,
        action:
            Action::Publish {
                account,
                what:
                    Publish::Note {
                        note_key: Some(key),
                        ..
                    },
            },
    } = input
    else {
        return None;
    };
    Some((req, account, key))
}

pub(super) fn key(input: &W) -> Option<String> {
    publish(input).map(|(_, _, key)| key.to_owned())
}

pub(super) fn input(h: &mut Host, client: u64, input: &W) -> bool {
    let now = h.time();
    match input {
        W::NoteOutbox { keys } => {
            let keys: Vec<_> = keys
                .iter()
                .take(128)
                .filter(|key| valid_key(key))
                .cloned()
                .collect();
            let statuses = h.engine.network.note_outbox.statuses(&keys);
            h.scope
                .direct(client, &Session::note_outbox(keys, statuses));
        }
        W::NoteDiscard { key } if valid_key(key) => h.engine.discard_signed_note(key, now),
        W::NoteDiscard { .. } => {}
        W::NoteWake => h.engine.wake_note_outbox(now),
        _ => {
            if let Some((req, account, key)) = publish(input)
                && (!valid_key(key) || h.engine.note_key_known(account, key))
            {
                h.scope
                    .direct(client, &Session::failure(req.to_owned(), "rejected"));
                return true;
            }
            return false;
        }
    }
    true
}

pub(super) fn sign_input(
    h: &mut Host,
    input: lkjstr_core::engine::protocol::Input,
    stamp: sign_trace::Stamp,
    key: Option<&str>,
) {
    use lkjstr_core::engine::protocol::Input;
    let req = if let (Some(key), Input::Action { req, .. }) = (key, &input) {
        Some((key, req.clone()))
    } else {
        None
    };
    h.sign_input(input, stamp);
    if let Some((key, req)) = req {
        h.engine.bind_note_key(&req, key.to_owned());
    }
}

pub(super) fn persist(host: &Rc<RefCell<Host>>) {
    let work = {
        let mut h = host.borrow_mut();
        if h.stopped || !h.loaded || h.note_outbox.busy || now() < h.note_outbox.next {
            return;
        }
        let Some(db) = h.db.clone() else { return };
        let Ok(expected) = h.account_store.state.expected() else {
            return;
        };
        let Some(checkpoint) = h.engine.network.note_outbox.snapshot() else {
            return;
        };
        let Ok(controller) = web_sys::AbortController::new() else {
            return;
        };
        h.note_outbox.busy = true;
        (db, expected, checkpoint, controller)
    };
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let (db, expected, checkpoint, controller) = work;
        let result = idb_accounts::run(
            &db,
            Change::NoteOutbox {
                expected,
                rows: checkpoint.rows,
            },
            &controller.signal(),
        )
        .await;
        let Some(host) = weak.upgrade() else { return };
        let mut h = host.borrow_mut();
        if h.stopped {
            return;
        }
        h.note_outbox.busy = false;
        if let Ok(idb_accounts::Reply::NoteOutbox(settled)) = result {
            h.engine.network.note_outbox.committed(checkpoint.revision);
            for status in settled {
                h.engine.reconcile_signed_note(status);
            }
        } else {
            h.note_outbox.next = now() + 1_500;
        }
    });
}
