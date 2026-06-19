use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{storage_worker::DEFAULT_WORKER_URL, thread_feed_host};

const DEFAULT_DB_NAME: &str = "lkjstr";

#[wasm_bindgen]
pub struct ThreadIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl ThreadIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl ThreadIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for ThreadIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_thread_tab(
    parent: HtmlElement,
    tab_id: String,
    event_id: String,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> ThreadIslandHandle {
    let provider = thread_feed_host::thread_feed_provider_with_worker_url(
        DEFAULT_DB_NAME.to_owned(),
        DEFAULT_WORKER_URL.to_owned(),
    );
    let open_thread = string_callback(open_thread);
    let unmount = lkjstr_ui::mount_thread_island(
        parent,
        tab_id,
        optional_string(event_id),
        provider,
        lkjstr_ui::ThreadIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(open_thread),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
        },
    );
    ThreadIslandHandle {
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
