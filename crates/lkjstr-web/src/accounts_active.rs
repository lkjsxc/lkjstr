pub fn active_account_id() -> Option<String> {
    local_storage()?.get_item(ACTIVE_ACCOUNT_KEY).ok().flatten()
}

pub fn set_active_account_id(id: Option<&str>) {
    let Some(storage) = local_storage() else {
        return;
    };
    match id {
        Some(id) => {
            let _result = storage.set_item(ACTIVE_ACCOUNT_KEY, id);
        }
        None => {
            let _result = storage.remove_item(ACTIVE_ACCOUNT_KEY);
        }
    }
}

const ACTIVE_ACCOUNT_KEY: &str = "lkjstr.activeAccountId";

fn local_storage() -> Option<web_sys::Storage> {
    web_sys::window()?.local_storage().ok().flatten()
}
