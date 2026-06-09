#![doc = "Rust/WASM browser bridge for lkjstr."]

#[cfg(target_arch = "wasm32")]
mod accounts_active;
#[cfg(target_arch = "wasm32")]
mod accounts_host;
#[cfg(target_arch = "wasm32")]
mod accounts_nip07_host;
#[cfg(target_arch = "wasm32")]
mod accounts_reveal_host;
#[cfg(target_arch = "wasm32")]
mod accounts_selector_host;
#[cfg(target_arch = "wasm32")]
mod accounts_selector_status;
#[cfg(target_arch = "wasm32")]
mod accounts_selector_store;
#[cfg(target_arch = "wasm32")]
mod app_log_host;
pub mod feed_geometry;
pub mod follow_graph;
#[cfg(target_arch = "wasm32")]
mod host_providers;
#[cfg(target_arch = "wasm32")]
mod host_status;
#[cfg(target_arch = "wasm32")]
mod nip07_host;
mod protocol_bridge;
#[cfg(target_arch = "wasm32")]
pub mod relay_host;
pub mod relay_score;
#[cfg(target_arch = "wasm32")]
mod relay_selection;
#[cfg(target_arch = "wasm32")]
mod relay_settings_host;
mod response;
pub mod retention_dispatch;
mod retention_routes;
pub mod scan_model;
#[cfg(target_arch = "wasm32")]
mod settings_host;
#[cfg(target_arch = "wasm32")]
mod sqlite_host_store;
#[cfg(target_arch = "wasm32")]
pub mod sqlite_store;
#[cfg(target_arch = "wasm32")]
pub mod storage_worker;
#[cfg(target_arch = "wasm32")]
mod tweet_host;
#[cfg(target_arch = "wasm32")]
mod upload_discovery;
#[cfg(target_arch = "wasm32")]
mod upload_settings_host;
#[cfg(target_arch = "wasm32")]
mod workspace_host;

#[cfg(target_arch = "wasm32")]
pub mod indexed_db;

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn start() {
    if !is_wasm_bindgen_test_runner() {
        mount_rust_workspace_shell();
    }
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell() {
    host_providers::mount_rust_workspace_shell();
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell_from_db(db_name: String) {
    host_providers::mount_rust_workspace_shell_from_db(db_name);
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell_from_db_with_worker(db_name: String, worker_url: String) {
    host_providers::mount_rust_workspace_shell_from_db_with_worker(db_name, worker_url);
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell_with_startup(startup: lkjstr_app::StartupInput) {
    lkjstr_ui::mount_app_with_startup(startup);
}

#[cfg(target_arch = "wasm32")]
fn is_wasm_bindgen_test_runner() -> bool {
    web_sys::window()
        .and_then(|window| window.location().pathname().ok())
        .is_some_and(|path| path.contains("wasm-bindgen-test"))
}

#[wasm_bindgen]
pub fn validate_event_json(json: &str) -> JsValue {
    protocol_bridge::validate_event_json(json)
}

#[wasm_bindgen]
pub fn verify_event_json(json: &str) -> JsValue {
    protocol_bridge::verify_event_json(json)
}

#[wasm_bindgen]
pub fn encode_client_message_json(json: &str) -> Result<String, JsValue> {
    protocol_bridge::encode_client_message_json(json)
}

#[wasm_bindgen]
pub fn decode_relay_message_json(json: &str) -> JsValue {
    protocol_bridge::decode_relay_message_json(json)
}

#[wasm_bindgen]
pub fn decode_nip19(text: &str) -> JsValue {
    protocol_bridge::decode_nip19_json(text)
}

#[wasm_bindgen]
pub fn encode_nip19(json: &str) -> Result<String, JsValue> {
    protocol_bridge::encode_nip19_json(json)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn indexed_db_available() -> JsValue {
    indexed_db::indexed_db_available_response().await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn put_workspace_record_json(json: &str) -> JsValue {
    indexed_db::workspace_put_json_response(json).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn get_workspace_record_json(id: &str) -> JsValue {
    indexed_db::workspace_get_json_response(id).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn put_setting_record_json(json: &str) -> JsValue {
    indexed_db::setting_put_json_response(json).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn get_setting_record_json(key: &str) -> JsValue {
    indexed_db::setting_get_json_response(key).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn put_tweet_draft_record_json(json: &str) -> JsValue {
    indexed_db::tweet_draft_put_json_response(json).await
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn get_tweet_draft_record_json(id: &str) -> JsValue {
    indexed_db::tweet_draft_get_json_response(id).await
}
