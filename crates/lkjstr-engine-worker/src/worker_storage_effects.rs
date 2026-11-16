//! Effect callbacks carry exact generations and only weak Host references.
use super::*;
pub(super) fn count(host: &Rc<RefCell<Host>>, lease: policy::Lease, db: web_sys::IdbDatabase) {
    let Ok(abort) = web_sys::AbortController::new() else {
        if let Some(at) = browser::now() {
            let mut h = host.borrow_mut();
            let reply = h.storage.book.count(&lease, policy::Count::Failed, at);
            deliver(&h, reply);
        }
        return;
    };
    let signal = abort.signal();
    host.borrow_mut()
        .storage
        .counts
        .insert(lease.client, (lease.clone(), abort));
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let Some(at) = browser::now() else {
            return;
        };
        let result = browser::count(&db, lease.deadline.saturating_sub(at) as u32, &signal).await;
        let Some(host) = weak.upgrade() else {
            return;
        };
        let mut h = host.borrow_mut();
        if h.storage
            .counts
            .get(&lease.client)
            .is_some_and(|(current, _)| current == &lease)
        {
            h.storage.counts.remove(&lease.client);
        }
        if let Some(at) = browser::now() {
            let reply = h.storage.book.count(&lease, result, at);
            deliver(&h, reply);
        }
        prune(&mut h);
    });
}
pub(super) fn origin(host: &Rc<RefCell<Host>>, leases: Vec<policy::Lease>) {
    let work = browser::estimate();
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let result = match work {
            Ok(work) => {
                let value = wasm_bindgen_futures::JsFuture::from(work).await;
                browser::now().map(|at| browser::estimated(value, at))
            }
            Err(failure) => Some(failure),
        };
        let Some(host) = weak.upgrade() else {
            return;
        };
        let mut h = host.borrow_mut();
        h.storage.estimating = false;
        if let (Some(value), Some(at)) = (result, browser::now()) {
            for lease in leases {
                let reply = h.storage.book.origin(&lease, value.clone(), at);
                deliver(&h, reply);
            }
        }
        prune(&mut h);
    });
}
