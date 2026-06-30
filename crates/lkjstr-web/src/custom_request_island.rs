use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{
    custom_request_host,
    product_storage_key::{PRODUCT_DATABASE_NAME, PRODUCT_WORKER_URL},
};
const DEFAULT_INPUT: &str = r#"{"kinds":[1],"limit":30}"#;

#[derive(serde::Deserialize)]
struct RestoredState {
    input: String,
    ran: bool,
}

#[wasm_bindgen]
pub struct CustomRequestIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl CustomRequestIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl CustomRequestIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for CustomRequestIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_custom_request_tab(
    parent: HtmlElement,
    tab_id: String,
    restored_state: String,
    save_state: Function,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> CustomRequestIslandHandle {
    let restored_state = restored_request_state(&restored_state);
    let provider = custom_request_host::custom_request_provider_with_worker_url(
        PRODUCT_DATABASE_NAME.to_owned(),
        PRODUCT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_custom_request_island(
        parent,
        tab_id,
        restored_state.input,
        restored_state.ran,
        provider,
        lkjstr_ui::CustomRequestIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
        },
        state_callback(save_state),
    );
    CustomRequestIslandHandle {
        unmount: Some(Box::new(unmount)),
    }
}

fn restored_request_state(raw: &str) -> RestoredState {
    serde_json::from_str(raw).unwrap_or_else(|_| RestoredState {
        input: DEFAULT_INPUT.to_owned(),
        ran: false,
    })
}

fn string_callback(function: Function) -> Callback<String> {
    Callback::new(move |value: String| {
        let _unused = function.call1(&JsValue::NULL, &JsValue::from_str(&value));
    })
}

fn pair_callback(function: Function) -> Callback<(String, String)> {
    Callback::new(move |(event_id, pubkey): (String, String)| {
        let _unused = function.call2(
            &JsValue::NULL,
            &JsValue::from_str(&event_id),
            &JsValue::from_str(&pubkey),
        );
    })
}

fn state_callback(function: Function) -> Callback<(String, bool)> {
    Callback::new(move |(input, ran): (String, bool)| {
        let _unused = function.call2(
            &JsValue::NULL,
            &JsValue::from_str(&input),
            &JsValue::from_bool(ran),
        );
    })
}
