//! Ciphertext-only archive reads/CAS; a short transaction checks a pinned removal nonce.
use js_sys::Promise;
use lkjstr_core::engine::dm::drafts;
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{IdbDatabase, IdbRequest, IdbTransaction, IdbTransactionMode};

pub type Live = Rc<dyn Fn() -> Result<(), &'static str>>;
pub type Track = Rc<dyn Fn(Option<IdbTransaction>)>;
pub struct Slot {
    pub generation: String,
    pub raw: Option<String>,
}
pub enum Change {
    Read {
        fresh_generation: String,
    },
    Compare {
        generation: String,
        expected: Option<String>,
        value: String,
    },
}
pub enum Reply {
    Read(Slot),
    Compared(bool),
}
type Handler = Closure<dyn FnMut(web_sys::Event)>;
struct Cleanup {
    tx: IdbTransaction,
    request: IdbRequest,
    _handlers: Vec<Handler>,
    track: Track,
}
impl Drop for Cleanup {
    fn drop(&mut self) {
        self.request.set_onsuccess(None);
        self.tx.set_oncomplete(None);
        self.tx.set_onabort(None);
        let _ = self.tx.abort();
        (self.track)(None);
    }
}
fn text(request: &IdbRequest) -> Result<Option<String>, &'static str> {
    let value = request.result().map_err(|_| "internal")?;
    if value.is_undefined() {
        Ok(None)
    } else {
        value.as_string().map(Some).ok_or("rejected")
    }
}
pub async fn run(
    db: &IdbDatabase,
    account: &str,
    change: Change,
    ms: u32,
    live: Live,
    track: Track,
) -> Result<Reply, &'static str> {
    live()?;
    let key = drafts::storage_key(account)?;
    let tx = db
        .transaction_with_str_and_mode("kv", IdbTransactionMode::Readwrite)
        .map_err(|_| "internal")?;
    let store = tx.object_store("kv").map_err(|_| "internal")?;
    let archive = store.get(&key.clone().into()).map_err(|_| "internal")?;
    let generation = store
        .get(&drafts::GENERATION_KEY.into())
        .map_err(|_| "internal")?;
    // IDB executes requests in this order. The last callback can read all three results.
    let accounts = store
        .get(&"engine-accounts".into())
        .map_err(|_| "internal")?;
    let outcome = Rc::new(RefCell::new(None));
    let mut handlers = Vec::new();
    let done = Promise::new(&mut |resolve, reject| {
        let complete = Handler::new(move |_| {
            let _ = resolve.call0(&JsValue::NULL);
        });
        let abort = Handler::new(move |_| {
            let _ = reject.call1(&JsValue::NULL, &"archive transaction aborted".into());
        });
        tx.set_oncomplete(Some(complete.as_ref().unchecked_ref()));
        tx.set_onabort(Some(abort.as_ref().unchecked_ref()));
        handlers.extend([complete, abort]);
    });
    let callback_account = account.to_owned();
    let callback_tx = tx.clone();
    let callback_request = accounts.clone();
    let callback_live = live.clone();
    let callback_outcome = outcome.clone();
    let step = Handler::new(move |_| {
        let next = (|| {
            callback_live()?;
            let saved = text(&callback_request)?.ok_or("signed-out")?;
            drafts::saved_account(&saved, &callback_account)?;
            let raw = text(&archive)?;
            let current_generation = text(&generation)?;
            match &change {
                Change::Read { fresh_generation } => {
                    let value = match current_generation {
                        Some(value) if drafts::generation(&value) => value,
                        Some(_) => return Err("rejected"),
                        None => {
                            if !drafts::generation(fresh_generation) {
                                return Err("rejected");
                            }
                            store
                                .put_with_key(
                                    &fresh_generation.clone().into(),
                                    &drafts::GENERATION_KEY.into(),
                                )
                                .map_err(|_| "internal")?;
                            fresh_generation.clone()
                        }
                    };
                    Ok(Reply::Read(Slot {
                        raw,
                        generation: value,
                    }))
                }
                Change::Compare {
                    generation,
                    expected,
                    value,
                } => {
                    let same = drafts::compare(
                        generation,
                        current_generation.as_deref(),
                        expected.as_deref(),
                        raw.as_deref(),
                    )?;
                    if same {
                        store
                            .put_with_key(&value.clone().into(), &key.clone().into())
                            .map_err(|_| "internal")?;
                    }
                    Ok(Reply::Compared(same))
                }
            }
        })();
        if next.is_err() {
            let _ = callback_tx.abort();
        }
        *callback_outcome.borrow_mut() = Some(next);
    });
    accounts.set_onsuccess(Some(step.as_ref().unchecked_ref()));
    handlers.push(step);
    track(Some(tx.clone()));
    let cleanup = Cleanup {
        tx: tx.clone(),
        request: accounts,
        _handlers: handlers,
        track,
    };
    let abort = tx.clone();
    let result = super::promise::bounded_ms(done, ms, "archive transaction deadline", move || {
        let _ = abort.abort();
    })
    .await;
    live()?;
    let reply = outcome.borrow_mut().take();
    drop(cleanup);
    match (result, reply) {
        (_, Some(Err(code))) => Err(code),
        (Ok(_), Some(Ok(reply))) => Ok(reply),
        _ => Err("internal"),
    }
}
