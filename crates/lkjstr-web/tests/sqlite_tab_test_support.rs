#![cfg(target_arch = "wasm32")]

use wasm_bindgen::prelude::JsValue;
use web_sys::Url;

const TEST_WORKER_URL: &str = "/static/sqlite-opfs-worker.js";

pub fn mount_sqlite_shell(db_name: String) -> Result<String, JsValue> {
    let url = TEST_WORKER_URL.to_owned();
    lkjstr_web::mount_rust_workspace_shell_from_db_with_worker(db_name, url.clone());
    Ok(url)
}

pub fn revoke_worker_url(url: &str) -> Result<(), JsValue> {
    Url::revoke_object_url(url)
}
