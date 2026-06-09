const ACTIVE_ACCOUNT_KEY: &str = "lkjstr.activeAccountId";

pub fn legacy_active_account_id() -> Option<String> {
    local_storage()?.get_item(ACTIVE_ACCOUNT_KEY).ok().flatten()
}

pub fn clear_legacy_active_account_id() {
    let Some(storage) = local_storage() else {
        return;
    };
    let _result = storage.remove_item(ACTIVE_ACCOUNT_KEY);
}

fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
