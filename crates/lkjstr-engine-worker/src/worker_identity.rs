//! At most four concurrent NIP-05 checks, with bounded retries.
use super::*;
pub(super) fn identities(host: &Rc<RefCell<Host>>) {
    let wanted = host.borrow().engine.identity_wants();
    for (key, name) in wanted {
        {
            let mut h = host.borrow_mut();
            if h.identity_inflight >= 4 {
                break;
            }
            if h.identity_attempts
                .get(&key)
                .is_some_and(|(n, at)| *n == name && now().saturating_sub(*at) < 3600000)
            {
                continue;
            }
            if h.identity_attempts.len() >= 512 {
                let oldest = h
                    .identity_attempts
                    .iter()
                    .min_by_key(|(_, (_, at))| at)
                    .map(|(key, _)| key.clone());
                if let Some(oldest) = oldest {
                    h.identity_attempts.remove(&oldest);
                }
            }
            h.identity_attempts
                .insert(key.clone(), (name.clone(), now()));
            h.identity_inflight += 1;
        }
        let observer = host.borrow().engine.network.fetches.clone();
        let weak = Rc::downgrade(host);
        wasm_bindgen_futures::spawn_local(async move {
            let identifier = lkjstr_nips::identity::Identifier::parse(&name);
            let response = match identifier {
                Ok(id) => {
                    use lkjstr_core::engine::fetch_records::{Lane, ResourceClass};
                    let url = id.url();
                    let observation = crate::browser::fetch_observation::HttpObservation::new(
                        observer,
                        ResourceClass::Nip05,
                        &url,
                        &url,
                        Lane::L2,
                    );
                    crate::browser::http::get_observed(&url, "application/json", 65536, observation)
                        .await
                        .ok()
                }
                Err(_) => None,
            };
            if let Some(h) = weak.upgrade() {
                let mut h = h.borrow_mut();
                h.identity_inflight = h.identity_inflight.saturating_sub(1);
                if !h.stopped
                    && let Some(response) = response
                {
                    h.engine.identity_result(&key, &name, response);
                    h.wake();
                }
            }
        });
    }
}
