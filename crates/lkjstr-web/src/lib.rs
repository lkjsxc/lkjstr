#![doc = "Rust/WASM browser bridge for lkjstr."]

#[cfg(target_arch = "wasm32")]
mod accounts_host;
mod protocol_bridge;
#[cfg(target_arch = "wasm32")]
mod relay_settings_host;
mod response;
#[cfg(target_arch = "wasm32")]
mod settings_host;

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
    mount_rust_workspace_shell_from_db(indexed_db::database::DEFAULT_DB_NAME.to_owned());
}

#[cfg(target_arch = "wasm32")]
pub fn mount_rust_workspace_shell_from_db(db_name: String) {
    wasm_bindgen_futures::spawn_local(async move {
        let startup =
            indexed_db::workspace_store::workspace_startup_input(&db_name, browser_now_ms()).await;
        let persistence = workspace_persistence(db_name.clone());
        let accounts_provider = accounts_host::accounts_provider(db_name.clone());
        let relay_settings_provider = relay_settings_host::relay_settings_provider(db_name.clone());
        let stats_provider = stats_provider(db_name.clone());
        let settings_provider = settings_host::settings_provider(db_name);
        lkjstr_ui::mount_app_with_host(
            startup,
            persistence,
            accounts_provider,
            relay_settings_provider,
            stats_provider,
            settings_provider,
        );
    });
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
fn browser_now_ms() -> u64 {
    let now = js_sys::Date::now();
    if now.is_sign_negative() {
        0
    } else {
        now as u64
    }
}

#[cfg(target_arch = "wasm32")]
fn workspace_persistence(db_name: String) -> lkjstr_ui::WorkspacePersistence {
    lkjstr_ui::WorkspacePersistence::new(move |workspace| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let _outcome = indexed_db::workspace_store::workspace_put(&db_name, &workspace).await;
        });
    })
}

#[cfg(target_arch = "wasm32")]
fn stats_provider(db_name: String) -> lkjstr_ui::StatsProvider {
    lkjstr_ui::StatsProvider::new(move |complete| {
        let db_name = db_name.clone();
        wasm_bindgen_futures::spawn_local(async move {
            complete.complete(indexed_db::inventory_store::storage_stats_snapshot(&db_name).await);
        });
    })
}
