//! Relay information fetches use the same bounded worker HTTP adapter.
use super::*;
pub(super) fn relay_info(host: &Rc<RefCell<Host>>, url: String) {
    let observer = host.borrow().engine.network.fetches.clone();
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let request = lkjstr_nips::metadata::information_request(&url);
        let result = match request {
            Ok((url, accept)) => {
                use lkjstr_core::engine::fetch_records::{Lane, ResourceClass};
                let observation = crate::browser::fetch_observation::HttpObservation::new(
                    observer,
                    ResourceClass::Nip11,
                    &url,
                    &url,
                    Lane::L2,
                );
                crate::browser::http::get_observed(&url, accept, 65536, observation)
                    .await
                    .ok()
            }
            Err(_) => None,
        };
        if let Some(h) = weak.upgrade() {
            let mut h = h.borrow_mut();
            if h.stopped {
                return;
            }
            let body = result.filter(|r| r.status == 200).map(|r| r.body);
            h.engine.relay_information(&url, body.as_deref());
            h.wake();
        }
    });
}
