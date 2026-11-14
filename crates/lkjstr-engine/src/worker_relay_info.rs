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
            if let Some(response) = result.filter(|r| r.status == 200) {
                h.engine.network.relay_information(&url, &response.body);
            }
        }
    });
}
