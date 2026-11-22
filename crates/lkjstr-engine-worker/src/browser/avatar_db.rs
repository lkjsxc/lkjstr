//! One disposable-cache connection and at most one unresolved opener per Worker Host.
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
use wasm_bindgen::{JsCast, JsValue, closure::Closure};
use web_sys::{AbortSignal, IdbDatabase};
#[path = "avatar_db_open.rs"]
mod open;
pub(super) type Handler = Closure<dyn FnMut(web_sys::Event)>;
#[derive(Default)]
struct State {
    promise: Option<js_sys::Promise>,
    pending: Option<Rc<open::Pending>>,
    connection: Option<Rc<Connection>>,
    failed: bool,
    stopped: bool,
}
pub(super) struct Connection {
    pub db: IdbDatabase,
    live: Cell<bool>,
    _changed: Handler,
}
impl Connection {
    fn new(db: IdbDatabase) -> Rc<Self> {
        Rc::new_cyclic(|weak: &std::rc::Weak<Self>| {
            let weak = weak.clone();
            let changed = Handler::new(move |_| {
                if let Some(connection) = weak.upgrade() {
                    connection.close();
                }
            });
            db.set_onversionchange(Some(changed.as_ref().unchecked_ref()));
            Self {
                db,
                live: Cell::new(true),
                _changed: changed,
            }
        })
    }
    fn close(&self) {
        self.live.set(false);
        self.db.close();
    }
}
impl Drop for Connection {
    fn drop(&mut self) {
        self.db.set_onversionchange(None);
        self.db.close();
    }
}
#[derive(Clone, Default)]
pub struct Database(Rc<RefCell<State>>);
impl Database {
    pub(super) async fn connection(&self, signal: &AbortSignal) -> Result<Rc<Connection>, JsValue> {
        crate::browser::abort::check(Some(signal))?;
        let promise = {
            let state = self.0.borrow();
            if state.failed || state.stopped {
                return Err("avatar-storage-unavailable".into());
            }
            state.promise.clone()
        };
        let promise = match promise {
            Some(promise) => promise,
            None => match open::start(&self.0) {
                Ok(promise) => {
                    self.0.borrow_mut().promise = Some(promise.clone());
                    promise
                }
                Err(error) => {
                    self.0.borrow_mut().failed = true;
                    return Err(error);
                }
            },
        };
        // Cancel only this waiter. The single non-abortable opener has its own two-second budget.
        crate::browser::abort::race(promise, Some(signal)).await?;
        self.0
            .borrow()
            .connection
            .clone()
            .filter(|connection| connection.live.get())
            .ok_or_else(|| "avatar-storage-unavailable".into())
    }
    pub fn close(&self) {
        let mut state = self.0.borrow_mut();
        state.stopped = true;
        if let Some(pending) = &state.pending {
            pending.cancel();
        }
        if let Some(connection) = state.connection.take() {
            connection.close();
        }
    }
}
