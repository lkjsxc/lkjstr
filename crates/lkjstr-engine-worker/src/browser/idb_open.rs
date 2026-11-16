//! A bounded opener cannot adopt a late connection or perform an abandoned upgrade.
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{AbortSignal, IdbDatabase, IdbOpenDbRequest};
type Handler = Closure<dyn FnMut(web_sys::Event)>;
const DB_NAME: &str = "lkjstr-wasm";
struct Pending {
    request: IdbOpenDbRequest,
    live: Cell<bool>,
    finished: Cell<bool>,
    handlers: RefCell<Vec<Handler>>,
    upgrade: RefCell<Option<super::idb_schema::Upgrade>>,
}
impl Pending {
    fn cancel(&self) {
        self.live.set(false);
        if let Some(tx) = self.request.transaction() {
            let _ = tx.abort();
        }
    }
    fn finish(state: &Rc<Self>) {
        if state.finished.replace(true) {
            return;
        }
        let state = state.clone();
        // Release handlers after the currently executing event callback returns.
        wasm_bindgen_futures::spawn_local(async move {
            state.request.set_onsuccess(None);
            state.request.set_onerror(None);
            state.request.set_onblocked(None);
            state.request.set_onupgradeneeded(None);
            state.upgrade.borrow_mut().take();
            state.handlers.borrow_mut().clear();
        });
    }
}
struct CancelOnDrop(Rc<Pending>);
impl Drop for CancelOnDrop {
    fn drop(&mut self) {
        self.0.cancel();
    }
}

pub async fn open(signal: &AbortSignal) -> Result<IdbDatabase, String> {
    super::abort::check(Some(signal)).map_err(|_| "storage open canceled")?;
    let factory: web_sys::IdbFactory = js_sys::Reflect::get(&js_sys::global(), &"indexedDB".into())
        .map_err(|_| "storage unavailable")?
        .dyn_into()
        .map_err(|_| "storage unavailable")?;
    let request = factory
        .open_with_u32(
            DB_NAME,
            lkjstr_core::engine::account_storage::DATABASE_SCHEMA,
        )
        .map_err(|_| "storage unavailable")?;
    let state = Rc::new(Pending {
        request,
        live: Cell::new(true),
        finished: Cell::new(false),
        handlers: RefCell::new(vec![]),
        upgrade: RefCell::new(None),
    });
    let cancel = CancelOnDrop(state.clone());
    let done = js_sys::Promise::new(&mut |resolve, reject| {
        let success = state.clone();
        let fail_success = reject.clone();
        let ok = Handler::new(move |_| {
            match success
                .request
                .result()
                .and_then(|v| v.dyn_into::<IdbDatabase>())
            {
                Ok(db) if success.live.replace(false) => {
                    let _ = resolve.call1(&JsValue::NULL, &db);
                }
                Ok(db) => {
                    db.close();
                    let _ = fail_success.call0(&JsValue::NULL);
                }
                Err(_) => {
                    let _ = fail_success.call0(&JsValue::NULL);
                }
            }
            Pending::finish(&success);
        });
        let failed = state.clone();
        let error = Handler::new(move |_| {
            failed.live.set(false);
            let _ = reject.call0(&JsValue::NULL);
            Pending::finish(&failed);
        });
        let upgrading = state.clone();
        let upgrade = Handler::new(move |event: web_sys::Event| {
            if !upgrading.live.get() {
                upgrading.cancel();
                return;
            }
            let result = event
                .dyn_into::<web_sys::IdbVersionChangeEvent>()
                .map_err(JsValue::from)
                .and_then(|e| super::idb_schema::begin(&upgrading.request, e.old_version()));
            match result {
                Ok(guard) => {
                    *upgrading.upgrade.borrow_mut() = Some(guard);
                }
                Err(_) => upgrading.cancel(),
            }
        });
        // blocked has no usable result/transaction. The original deadline remains.
        let blocked = Handler::new(move |_| {});
        state
            .request
            .set_onsuccess(Some(ok.as_ref().unchecked_ref()));
        state
            .request
            .set_onerror(Some(error.as_ref().unchecked_ref()));
        state
            .request
            .set_onupgradeneeded(Some(upgrade.as_ref().unchecked_ref()));
        state
            .request
            .set_onblocked(Some(blocked.as_ref().unchecked_ref()));
        state
            .handlers
            .borrow_mut()
            .extend([ok, error, upgrade, blocked]);
    });
    let stopped = state.clone();
    let abort = super::abort::listen(signal, move || stopped.cancel())
        .map_err(|_| "storage unavailable")?;
    let expired = state.clone();
    let value = super::promise::bounded_ms_for(
        done,
        15_000,
        "storage open timed out",
        move || expired.cancel(),
        Some(signal),
    )
    .await;
    drop(abort);
    drop(cancel); // Also marks timer-allocation failure and canceled callers inactive.
    let db = value
        .map_err(|_| "storage unavailable")?
        .dyn_into::<IdbDatabase>()
        .map_err(|_| "storage unavailable")?;
    if signal.aborted() {
        db.close();
        return Err("storage open canceled".into());
    }
    // Keep an active connection until explicit normal Host close. A future schema
    // upgrade must block rather than discard this Host's unflushed editor state.
    Ok(db)
}
