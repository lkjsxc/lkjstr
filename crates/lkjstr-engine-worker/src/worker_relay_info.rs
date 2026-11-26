//! Relay information fetches use the same bounded worker HTTP adapter.
use super::*;
pub(super) fn relay_info(host: &Rc<RefCell<Host>>, url: String) {
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let request = lkjstr_nips::metadata::information_request(&url);
        let result = match request {
            Ok((url, accept)) => crate::browser::http::get(&url, accept, 65536).await.ok(),
            Err(_) => None,
        };
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            if h.stopped {
                return;
            }
            let body = result.filter(|r| r.status == 200).map(|r| r.body);
            h.engine.relay_information(&url, body.as_deref());
        }
    });
}
