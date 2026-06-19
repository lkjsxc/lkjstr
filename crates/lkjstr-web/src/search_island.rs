use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{search_feed_host, storage_worker::DEFAULT_WORKER_URL};

const DEFAULT_DB_NAME: &str = "lkjstr";

#[wasm_bindgen]
pub struct SearchIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl SearchIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl SearchIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for SearchIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_search_tab(
    parent: HtmlElement,
    tab_id: String,
    restored_query: String,
    save_query: Function,
    open_profile: Function,
    open_thread: Function,
    open_author_context: Function,
) -> SearchIslandHandle {
    let provider = search_feed_host::search_feed_provider_with_worker_url(
        DEFAULT_DB_NAME.to_owned(),
        DEFAULT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_search_island(
        parent,
        tab_id,
        restored_query,
        provider,
        lkjstr_ui::SearchIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
        },
        string_callback(save_query),
    );
    SearchIslandHandle {
        unmount: Some(Box::new(unmount)),
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
