//! One transaction binds account reads/writes to a checked durable revision.
use lkjstr_core::engine::{
    account_storage::{self, Failure, Loaded, Read, Revision},
    accounts::secret::SecretText,
};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{AbortSignal, IdbDatabase, IdbRequest, IdbTransaction, IdbTransactionMode};
type Handler = Closure<dyn FnMut(web_sys::Event)>;

pub enum Change {
    Load,
    NoteOutbox {
        expected: Revision,
        rows: Vec<(String, String)>,
    },
    Commit {
        expected: Revision,
        saved: Option<SecretText>,
        removals: Vec<(String, Option<String>)>,
    },
}
pub enum Reply {
    Loaded(Loaded),
    Committed(Revision),
    NoteOutbox(Vec<lkjstr_core::engine::network::note_outbox::Status>),
}
struct Cleanup {
    tx: IdbTransaction,
    request: IdbRequest,
    _handlers: Vec<Handler>,
}
impl Drop for Cleanup {
    fn drop(&mut self) {
        self.request.set_onsuccess(None);
        self.tx.set_oncomplete(None);
        self.tx.set_onabort(None);
        let _ = self.tx.abort();
    }
}
fn load(
    accounts: &super::idb_account_value::Record,
    revision: &super::idb_account_value::Record,
) -> Result<Loaded, Failure> {
    let raw = accounts.text()?;
    let revision = revision.text()?;
    account_storage::load(
        raw.as_deref().map_or(Read::Absent, Read::Text),
        revision.as_deref().map_or(Read::Absent, Read::Text),
    )
}
pub async fn run(db: &IdbDatabase, change: Change, signal: &AbortSignal) -> Result<Reply, Failure> {
    super::abort::check(Some(signal)).map_err(|_| Failure::Unavailable)?;
    let mode = if matches!(change, Change::Load) {
        IdbTransactionMode::Readonly
    } else {
        IdbTransactionMode::Readwrite
    };
    let tx = db
        .transaction_with_str_and_mode("kv", mode)
        .map_err(|_| Failure::Unavailable)?;
    let store = tx.object_store("kv").map_err(|_| Failure::Unavailable)?;
    let note_rows = match &change {
        Change::NoteOutbox { rows, .. } => rows
            .iter()
            .map(|(key, _)| {
                store
                    .get(&key.as_str().into())
                    .map_err(|_| Failure::Unavailable)
            })
            .collect::<Result<Vec<_>, _>>()?,
        _ => vec![],
    };
    let accounts = super::idb_account_value::Record::read(&store, account_storage::ACCOUNTS_KEY)?;
    let revision = super::idb_account_value::Record::read(&store, account_storage::REVISION_KEY)?;
    let request = revision.key.clone();
    let outcome = Rc::new(RefCell::new(None));
    let mut handlers = Vec::new();
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        let complete = Handler::new(move |_| {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let abort = Handler::new(move |_| {
            let _ = reject.call0(&JsValue::NULL);
        });
        tx.set_oncomplete(Some(complete.as_ref().unchecked_ref()));
        tx.set_onabort(Some(abort.as_ref().unchecked_ref()));
        handlers.extend([complete, abort]);
    });
    let step_tx = tx.clone();
    let step_signal = signal.clone();
    let step_outcome = outcome.clone();
    let step = Handler::new(move |_| {
        let result = (|| {
            if step_signal.aborted() {
                return Err(Failure::Unavailable);
            }
            let loaded = load(&accounts, &revision)?;
            match &change {
                Change::Load => Ok(Reply::Loaded(loaded)),
                Change::NoteOutbox { expected, rows } => {
                    expected.compare(loaded.revision, false)?;
                    let mut settled = vec![];
                    for ((key, update), request) in rows.iter().zip(&note_rows) {
                        let value = request.result().map_err(|_| Failure::Unavailable)?;
                        let current = value.as_string();
                        if !value.is_undefined() && current.is_none() {
                            return Err(Failure::Unavailable);
                        }
                        let merged = lkjstr_core::engine::network::note_outbox::merge(
                            current.as_deref(),
                            update,
                        )
                        .ok_or(Failure::Unavailable)?;
                        store
                            .put_with_key(&merged.raw.into(), &key.as_str().into())
                            .map_err(|_| Failure::Unavailable)?;
                        settled.extend(merged.settled);
                    }
                    Ok(Reply::NoteOutbox(settled))
                }
                Change::Commit {
                    expected,
                    saved,
                    removals,
                } => {
                    if saved.is_none() && !removals.is_empty() {
                        return Err(Failure::Unavailable);
                    }
                    let next = expected.compare(loaded.revision, saved.is_some())?;
                    if let Some(saved) = saved {
                        // Validate before queuing any write; discard the temporary decoded copy.
                        account_storage::load(Read::Text(saved), Read::Text(&next.encoded()))?;
                        store
                            .put_with_key(
                                &JsValue::from_str(saved),
                                &account_storage::ACCOUNTS_KEY.into(),
                            )
                            .map_err(|_| Failure::Unavailable)?;
                        store
                            .put_with_key(
                                &next.encoded().into(),
                                &account_storage::REVISION_KEY.into(),
                            )
                            .map_err(|_| Failure::Unavailable)?;
                        for (key, value) in removals {
                            match value {
                                Some(value) => {
                                    store
                                        .put_with_key(&value.as_str().into(), &key.as_str().into())
                                        .map_err(|_| Failure::Unavailable)?;
                                }
                                None => {
                                    store
                                        .delete(&key.as_str().into())
                                        .map_err(|_| Failure::Unavailable)?;
                                }
                            }
                        }
                    }
                    Ok(Reply::Committed(next))
                }
            }
        })();
        let failed = result.is_err();
        *step_outcome.borrow_mut() = Some(result);
        if failed {
            let _ = step_tx.abort();
        }
    });
    request.set_onsuccess(Some(step.as_ref().unchecked_ref()));
    handlers.push(step);
    let cleanup = Cleanup {
        tx: tx.clone(),
        request,
        _handlers: handlers,
    };
    let stop_tx = tx.clone();
    let abort = super::abort::listen(signal, move || {
        let _ = stop_tx.abort();
    })
    .map_err(|_| Failure::Unavailable)?;
    let timeout_tx = tx.clone();
    let committed = super::promise::bounded_ms_for(
        done,
        15_000,
        "storage transaction timed out",
        move || {
            let _ = timeout_tx.abort();
        },
        Some(signal),
    )
    .await;
    drop(abort);
    drop(cleanup);
    let result = outcome
        .borrow_mut()
        .take()
        .unwrap_or(Err(Failure::Unavailable));
    if committed.is_err() {
        return Err(result.err().unwrap_or(Failure::Unavailable));
    }
    result
}
