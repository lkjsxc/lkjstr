use std::rc::{Rc, Weak};
use std::sync::{Arc, Mutex};

use send_wrapper::SendWrapper;

#[derive(Clone)]
pub(crate) struct RelayReadHandle {
    cancel: Arc<dyn Fn() + Send + Sync>,
}

#[derive(Clone, Default)]
pub(crate) struct RelayReadSlot {
    handle: Arc<Mutex<Option<RelayReadHandle>>>,
}

impl RelayReadHandle {
    pub(crate) fn from_rc<T: 'static>(read: &Rc<T>, cancel: fn(&T)) -> Self {
        let weak = SendWrapper::new(Rc::downgrade(read));
        Self {
            cancel: Arc::new(move || {
                let weak: &Weak<T> = &weak;
                if let Some(read) = weak.upgrade() {
                    cancel(&read);
                }
            }),
        }
    }

    pub(crate) fn cancel(&self) {
        (self.cancel)();
    }
}

impl RelayReadSlot {
    pub(crate) fn replace(&self, handle: RelayReadHandle) {
        let previous = match self.handle.lock() {
            Ok(mut slot) => slot.replace(handle),
            Err(_) => Some(handle),
        };
        if let Some(previous) = previous {
            previous.cancel();
        }
    }

    pub(crate) fn cancel(&self) {
        let handle = match self.handle.lock() {
            Ok(mut slot) => slot.take(),
            Err(_) => None,
        };
        if let Some(handle) = handle {
            handle.cancel();
        }
    }
}
