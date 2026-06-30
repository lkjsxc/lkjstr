use js_sys::Function;
use lkjstr_ui::Callback;
use wasm_bindgen::prelude::{JsValue, wasm_bindgen};
use web_sys::HtmlElement;

use crate::{
    followees_host,
    product_storage_key::{PRODUCT_DATABASE_NAME, PRODUCT_WORKER_URL},
};

#[wasm_bindgen]
pub struct FolloweesIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl FolloweesIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl FolloweesIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for FolloweesIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_followees_tab(
    parent: HtmlElement,
    tab_id: String,
    pubkey: String,
    open_profile: Function,
    open_user_timeline: Function,
    copy_npub: Function,
) -> FolloweesIslandHandle {
    let provider = followees_host::followees_provider_with_worker_url(
        PRODUCT_DATABASE_NAME.to_owned(),
        PRODUCT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_followees_island(
        parent,
        tab_id,
        non_empty(pubkey),
        provider,
        lkjstr_ui::FolloweesIslandActions {
            open_profile: Some(string_callback(open_profile)),
            open_user_timeline: Some(string_callback(open_user_timeline)),
            copy_npub: Some(string_callback(copy_npub)),
        },
    );
    FolloweesIslandHandle {
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
