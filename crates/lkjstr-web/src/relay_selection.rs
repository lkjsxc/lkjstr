use lkjstr_domain::{RelayPurpose, RelaySet};

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

pub fn selected_read_relays(sets: &[RelaySet]) -> Vec<String> {
    selected_relays(sets, |relay| relay.read)
}

pub fn selected_write_relays(sets: &[RelaySet]) -> Vec<String> {
    selected_relays(sets, |relay| relay.write)
}

fn selected_relays(sets: &[RelaySet], accepts: impl Fn(&lkjstr_domain::RelayRecord) -> bool) -> Vec<String> {
    let selected = selected_relay_set_id();
    let fallback = sets.iter().find(|set| set.purpose == RelayPurpose::User);
    let set = selected
        .and_then(|id| sets.iter().find(|set| set.id == id))
        .or(fallback);
    set.into_iter()
        .flat_map(|set| set.relays.iter())
        .filter(|relay| relay.enabled && accepts(relay))
        .map(|relay| relay.url.clone())
        .collect()
}

fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
