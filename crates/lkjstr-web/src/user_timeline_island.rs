use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{storage_worker::DEFAULT_WORKER_URL, user_timeline_host};

const DEFAULT_DB_NAME: &str = "lkjstr";

#[wasm_bindgen]
pub struct UserTimelineIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl UserTimelineIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl UserTimelineIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for UserTimelineIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_user_timeline_tab(
    parent: HtmlElement,
    tab_id: String,
    pubkey: String,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> UserTimelineIslandHandle {
    let provider = user_timeline_host::user_timeline_provider_with_worker_url(
        DEFAULT_DB_NAME.to_owned(),
        DEFAULT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_user_timeline_island(
        parent,
        tab_id,
        non_empty(pubkey),
        provider,
        lkjstr_ui::UserTimelineIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
        },
    );
    UserTimelineIslandHandle {
        unmount: Some(Box::new(unmount)),
    }
}

fn non_empty(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
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
