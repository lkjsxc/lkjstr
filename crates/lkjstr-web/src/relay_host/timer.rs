use std::cell::{Cell, RefCell};
use std::rc::Rc;

use wasm_bindgen::{JsCast, closure::Closure};

use crate::relay_host::{RelayHostProblem, RelayHostProblemKind, RelayHostResult};

#[derive(Clone)]
pub struct BrowserTimeout {
    inner: Rc<BrowserTimeoutInner>,
}

struct BrowserTimeoutInner {
    handle: Cell<Option<i32>>,
    callback: RefCell<Option<Closure<dyn FnMut()>>>,
}

impl BrowserTimeout {
    pub fn schedule(delay_ms: u32, callback: impl FnMut() + 'static) -> RelayHostResult<Self> {
        let Some(window) = web_sys::window() else {
            return Err(RelayHostProblem::new(
                RelayHostProblemKind::Unavailable,
                "timer-open",
                "missing-window",
            ));
        };

        let inner = Rc::new(BrowserTimeoutInner {
            handle: Cell::new(None),
            callback: RefCell::new(None),
        });
        let weak_inner = Rc::downgrade(&inner);
        let mut callback = callback;
        let closure = Closure::wrap(Box::new(move || {
            if let Some(inner) = weak_inner.upgrade() {
                inner.handle.set(None);
            }
            callback();
        }) as Box<dyn FnMut()>);
        let handle = window
            .set_timeout_with_callback_and_timeout_and_arguments_0(
                closure.as_ref().unchecked_ref(),
                clamp_timeout(delay_ms),
            )
            .map_err(|error| {
                RelayHostProblem::js(RelayHostProblemKind::Unavailable, "timer-open", error)
            })?;
        inner.handle.set(Some(handle));
        inner.callback.borrow_mut().replace(closure);
        Ok(Self { inner })
    }

    pub fn active(&self) -> bool {
        self.inner.handle.get().is_some()
    }

    pub fn clear(&self) {
        self.inner.clear();
    }
}

impl BrowserTimeoutInner {
    fn clear(&self) {
        if let Some(handle) = self.handle.take()
            && let Some(window) = web_sys::window()
        {
            window.clear_timeout_with_handle(handle);
        }
        self.callback.borrow_mut().take();
    }
}

impl Drop for BrowserTimeoutInner {
    fn drop(&mut self) {
        self.clear();
    }
}

fn clamp_timeout(delay_ms: u32) -> i32 {
    i32::try_from(delay_ms).map_or(i32::MAX, |delay| delay)
}
