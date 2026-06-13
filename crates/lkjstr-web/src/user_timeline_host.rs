use lkjstr_ui::UserTimelineProvider;

use crate::{
    relay_read_handle::RelayReadSlot,
    user_timeline_host_model::user_timeline_load,
    user_timeline_relay::start_user_timeline_relay_read,
};

pub(crate) const PAGE_SIZE: u64 = 30;
pub(crate) const WINDOW_MAX: usize = 180;

#[derive(Clone)]
pub(crate) struct UserTimelineHost {
    pub(crate) db_name: String,
    pub(crate) worker_url: String,
}

pub(crate) fn user_timeline_provider_with_worker_url(
    db_name: String,
    worker_url: String,
) -> UserTimelineProvider {
    let host = UserTimelineHost {
        db_name,
        worker_url,
    };
    UserTimelineProvider::new(move |request| {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let owner = request.owner.clone();
            let target = request.target_pubkey.clone();
            let lease = request.lease();
            let relay_slot = RelayReadSlot::default();
            let release_slot = relay_slot.clone();
            lease.on_release(move || release_slot.cancel());
            if lease.is_released() {
                return;
            }
            let load = user_timeline_load(&host, &owner, target).await;
            if lease.is_released() {
                return;
            }
            request.complete(load.model);
            let Some(relay_input) = load.relay else {
                return;
            };
            let relay_request = request.clone();
            let relay_lease = lease.clone();
            if let Some(handle) = start_user_timeline_relay_read(host, relay_input, move |model| {
                if !relay_lease.is_released() {
                    relay_request.complete(model);
                }
            }) {
                relay_slot.replace(handle);
            }
        });
    })
}
