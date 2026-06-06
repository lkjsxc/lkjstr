const SELECTED_RELAY_SET_KEY: &str = "lkjstr.defaultRelaySetId";

pub fn selected_relay_set_id() -> Option<String> {
    local_storage()?
        .get_item(SELECTED_RELAY_SET_KEY)
        .ok()
        .flatten()
}

pub fn set_selected_relay_set_id(id: &str) {
    if let Some(storage) = local_storage() {
        let _result = storage.set_item(SELECTED_RELAY_SET_KEY, id);
    }
}

fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
