//! A timed-out open never starts a replacement or adopts a late database.
use super::*;
use crate::browser::timer::Timer;
use web_sys::{IdbFactory, IdbOpenDbRequest};
pub(super) struct Pending {
    request: IdbOpenDbRequest,
    live: Cell<bool>,
    handlers: RefCell<Vec<Handler>>,
    timer: RefCell<Option<Timer>>,
    reject: RefCell<Option<js_sys::Function>>,
}
impl Pending {
    pub(super) fn cancel(&self) {
        self.live.set(false);
        if let Some(tx) = self.request.transaction() {
            let _ = tx.abort();
        }
        if let Some(reject) = self.reject.borrow().as_ref() {
            let _ = reject.call0(&JsValue::NULL);
        }
    }
    fn finish(state: Rc<Self>, owner: std::rc::Weak<RefCell<State>>) {
        wasm_bindgen_futures::spawn_local(async move {
            state.request.set_onsuccess(None);
            state.request.set_onerror(None);
            state.request.set_onblocked(None);
            state.request.set_onupgradeneeded(None);
            state.handlers.borrow_mut().clear();
            state.timer.borrow_mut().take();
            state.reject.borrow_mut().take();
            if let Some(owner) = owner.upgrade() {
                owner.borrow_mut().pending.take();
            }
        });
    }
}
pub(super) fn start(owner: &Rc<RefCell<State>>) -> Result<js_sys::Promise, JsValue> {
    let factory: IdbFactory =
        js_sys::Reflect::get(&js_sys::global(), &"indexedDB".into())?.dyn_into()?;
    let state = Rc::new(Pending {
        request: factory.open_with_u32("lkjstr-avatar-v1", 1)?,
        live: Cell::new(true),
        handlers: RefCell::new(Vec::new()),
        timer: RefCell::new(None),
        reject: RefCell::new(None),
    });
    owner.borrow_mut().pending = Some(state.clone());
    let owner = Rc::downgrade(owner);
    let promise = js_sys::Promise::new(&mut |resolve, reject| {
        *state.reject.borrow_mut() = Some(reject.clone());
        let success = state.clone();
        let target = owner.clone();
        let fail = reject.clone();
        let ok = Handler::new(move |_| {
            let value = success
                .request
                .result()
                .and_then(|value| value.dyn_into::<IdbDatabase>());
            if let Ok(db) = value {
                let owner = target.upgrade();
                let usable = success.live.replace(false)
                    && owner
                        .as_ref()
                        .is_some_and(|owner| !owner.borrow().stopped && !owner.borrow().failed)
                    && ["meta", "entries", "blobs"]
                        .iter()
                        .all(|store| db.object_store_names().contains(store));
                if let Some(owner) = owner.filter(|_| usable) {
                    owner.borrow_mut().connection = Some(Connection::new(db));
                    let _ = resolve.call0(&JsValue::NULL);
                } else {
                    db.close();
                    let _ = fail.call0(&JsValue::NULL);
                }
            } else {
                let _ = fail.call0(&JsValue::NULL);
            }
            Pending::finish(success.clone(), target.clone());
        });
        let failed = state.clone();
        let target = owner.clone();
        let error = Handler::new(move |_| {
            failed.live.set(false);
            if let Some(owner) = target.upgrade() {
                owner.borrow_mut().failed = true;
            }
            let _ = reject.call0(&JsValue::NULL);
            Pending::finish(failed.clone(), target.clone());
        });
        let upgrading = state.clone();
        let upgrade = Handler::new(move |_| {
            if !upgrading.live.get() {
                upgrading.cancel();
                return;
            }
            let result = upgrading
                .request
                .result()
                .and_then(|value| value.dyn_into::<IdbDatabase>())
                .and_then(|db| {
                    for store in ["meta", "entries", "blobs"] {
                        if !db.object_store_names().contains(store) {
                            db.create_object_store(store)?;
                        }
                    }
                    Ok(())
                });
            if result.is_err() {
                upgrading.cancel();
            }
        });
        state
            .request
            .set_onsuccess(Some(ok.as_ref().unchecked_ref()));
        state
            .request
            .set_onerror(Some(error.as_ref().unchecked_ref()));
        state
            .request
            .set_onupgradeneeded(Some(upgrade.as_ref().unchecked_ref()));
        state.handlers.borrow_mut().extend([ok, error, upgrade]);
    });
    let timeout = state.clone();
    let target = owner.clone();
    match Timer::after(2000, move || {
        if let Some(owner) = target.upgrade() {
            owner.borrow_mut().failed = true;
        }
        timeout.cancel();
    }) {
        Ok(timer) => {
            *state.timer.borrow_mut() = Some(timer);
        }
        Err(_) => {
            if let Some(owner) = owner.upgrade() {
                owner.borrow_mut().failed = true;
            }
            state.cancel();
        }
    }
    Ok(promise)
}
