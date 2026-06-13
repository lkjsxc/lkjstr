use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub(super) struct LocalLease {
    state: Arc<LocalLeaseState>,
}

struct LocalLeaseState {
    released: AtomicBool,
    cleanup: Mutex<Vec<Box<dyn FnOnce() + Send + Sync>>>,
}

impl LocalLease {
    #[must_use]
    pub(super) fn new() -> Self {
        Self {
            state: Arc::new(LocalLeaseState {
                released: AtomicBool::new(false),
                cleanup: Mutex::new(Vec::new()),
            }),
        }
    }

    pub(super) fn release(&self) {
        if self.state.released.swap(true, Ordering::SeqCst) {
            return;
        }
        let callbacks = match self.state.cleanup.lock() {
            Ok(mut cleanup) => std::mem::take(&mut *cleanup),
            Err(_) => Vec::new(),
        };
        for cleanup in callbacks {
            cleanup();
        }
    }

    #[must_use]
    pub(super) fn is_released(&self) -> bool {
        self.state.released.load(Ordering::SeqCst)
    }

    pub(super) fn on_release(&self, cleanup: impl FnOnce() + Send + Sync + 'static) {
        let Ok(mut cleanup_slot) = self.state.cleanup.lock() else {
            cleanup();
            return;
        };
        if self.is_released() {
            drop(cleanup_slot);
            cleanup();
        } else {
            cleanup_slot.push(Box::new(cleanup));
        }
    }
}
