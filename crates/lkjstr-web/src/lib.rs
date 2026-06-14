#![doc = "Rust/WASM browser bridge for lkjstr."]

#[cfg(all(test, target_arch = "wasm32"))]
wasm_bindgen_test::wasm_bindgen_test_configure!(run_in_browser);

#[cfg(target_arch = "wasm32")]
mod author_context_cache;
#[cfg(target_arch = "wasm32")]
mod author_context_host;
#[cfg(target_arch = "wasm32")]
mod author_context_relay;
#[cfg(target_arch = "wasm32")]
mod author_context_relay_input;
#[cfg(target_arch = "wasm32")]
mod author_context_relay_model;
#[cfg(target_arch = "wasm32")]
mod author_context_relay_read;
#[cfg(target_arch = "wasm32")]
mod author_context_relay_read_tail;
#[cfg(all(target_arch = "wasm32", debug_assertions))]
#[doc(hidden)]
pub mod author_context_relay_test_api;
#[cfg(target_arch = "wasm32")]
mod author_context_routes;
pub mod feed_geometry;
pub mod follow_graph;
#[cfg(target_arch = "wasm32")]
mod profile_feed_status;
#[cfg(target_arch = "wasm32")]
include!("wasm_modules.rs");
mod protocol_bridge;
#[cfg(target_arch = "wasm32")]
mod relay_read_handle;
pub mod relay_score;
pub mod repair_adapter;
mod response;
pub mod retention_dispatch;
mod retention_routes;
pub mod scan_model;
#[cfg(target_arch = "wasm32")]
mod thread_feed_status;

#[cfg(target_arch = "wasm32")]
pub use author_context_island::{AuthorContextIslandHandle, mount_author_context_tab};
#[cfg(target_arch = "wasm32")]
pub use followees_island::{FolloweesIslandHandle, mount_followees_tab};
#[cfg(target_arch = "wasm32")]
pub use mount_api::{
    mount_rust_workspace_shell, mount_rust_workspace_shell_from_db,
    mount_rust_workspace_shell_from_db_with_worker,
    mount_rust_workspace_shell_with_author_context_feed_provider,
    mount_rust_workspace_shell_with_global_feed, mount_rust_workspace_shell_with_home_feed,
    mount_rust_workspace_shell_with_profile_feed,
    mount_rust_workspace_shell_with_profile_feed_and_followees_provider,
    mount_rust_workspace_shell_with_profile_feed_followees_and_user_timeline_provider,
    mount_rust_workspace_shell_with_profile_feed_provider, mount_rust_workspace_shell_with_startup,
};
#[cfg(target_arch = "wasm32")]
pub use user_timeline_island::{UserTimelineIslandHandle, mount_user_timeline_tab};

use wasm_bindgen::prelude::{JsValue, wasm_bindgen};

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
