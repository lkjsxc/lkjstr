use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{
    notifications_feed_host,
    product_storage_key::{PRODUCT_DATABASE_NAME, PRODUCT_WORKER_URL},
};

#[wasm_bindgen]
pub struct NotificationsIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl NotificationsIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl NotificationsIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for NotificationsIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_notifications_tab(
    parent: HtmlElement,
    tab_id: String,
    active_pubkey: String,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> NotificationsIslandHandle {
    let provider = notifications_feed_host::notifications_feed_provider_with_worker_url(
        PRODUCT_DATABASE_NAME.to_owned(),
        PRODUCT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_notifications_island(
        parent,
        tab_id,
        optional_string(active_pubkey),
        provider,
        lkjstr_ui::NotificationsIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
        },
    );
    NotificationsIslandHandle {
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
