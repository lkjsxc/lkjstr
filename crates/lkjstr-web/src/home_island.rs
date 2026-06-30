use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{
    home_feed_host,
    product_storage_key::{PRODUCT_DATABASE_NAME, PRODUCT_WORKER_URL},
};

#[wasm_bindgen]
pub struct HomeIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl HomeIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl HomeIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for HomeIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_home_tab(
    parent: HtmlElement,
    tab_id: String,
    active_pubkey: String,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> HomeIslandHandle {
    let provider = home_feed_host::home_feed_provider_with_page_account(
        PRODUCT_DATABASE_NAME.to_owned(),
        PRODUCT_WORKER_URL.to_owned(),
        optional_string(active_pubkey.clone()),
    );
    let unmount = lkjstr_ui::mount_home_island(
        parent,
        tab_id,
        optional_string(active_pubkey),
        provider,
        lkjstr_ui::HomeIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
        },
    );
    HomeIslandHandle {
        unmount: Some(Box::new(unmount)),
    }
}

fn optional_string(value: String) -> Option<String> {
    if value.is_empty() { None } else { Some(value) }
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
