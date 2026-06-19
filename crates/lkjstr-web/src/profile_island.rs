use js_sys::{Function, Reflect};
use lkjstr_ui::Callback;
use wasm_bindgen::{
    JsCast,
    prelude::{JsValue, wasm_bindgen},
};
use web_sys::HtmlElement;

use crate::{profile_feed_host, profile_follow_host, storage_worker::DEFAULT_WORKER_URL};

const DEFAULT_DB_NAME: &str = "lkjstr";

#[wasm_bindgen]
pub struct ProfileIslandHandle {
    unmount: Option<Box<dyn FnMut()>>,
}

#[wasm_bindgen]
impl ProfileIslandHandle {
    pub fn unmount(&mut self) {
        self.release();
    }
}

impl ProfileIslandHandle {
    fn release(&mut self) {
        if let Some(mut unmount) = self.unmount.take() {
            unmount();
        }
    }
}

impl Drop for ProfileIslandHandle {
    fn drop(&mut self) {
        self.release();
    }
}

#[wasm_bindgen]
pub fn mount_profile_tab(
    parent: HtmlElement,
    tab_id: String,
    pubkey: String,
    active_pubkey: String,
    actions: JsValue,
) -> Result<ProfileIslandHandle, JsValue> {
    let open_profile = function_field(&actions, "openProfile")?;
    let open_followees = function_field(&actions, "openFollowees")?;
    let open_user_timeline = function_field(&actions, "openUserTimeline")?;
    let open_profile_edit = function_field(&actions, "openProfileEdit")?;
    let open_thread = function_field(&actions, "openThread")?;
    let open_author_context = function_field(&actions, "openAuthorContext")?;
    let provider = profile_feed_host::profile_feed_provider_with_worker_url(
        DEFAULT_DB_NAME.to_owned(),
        DEFAULT_WORKER_URL.to_owned(),
    );
    let follow_profile = profile_follow_host::profile_follow_provider_with_worker_url(
        DEFAULT_DB_NAME.to_owned(),
        DEFAULT_WORKER_URL.to_owned(),
    );
    let unmount = lkjstr_ui::mount_profile_island(
        parent,
        tab_id,
        optional_string(pubkey),
        provider,
        lkjstr_ui::ProfileIslandActions {
            active_account_pubkey: optional_string(active_pubkey),
            open_profile: Some(string_callback(open_profile)),
            open_followees: Some(string_callback(open_followees)),
            open_user_timeline: Some(string_callback(open_user_timeline)),
            open_profile_edit: Some(unit_callback(open_profile_edit)),
            open_thread: Some(string_callback(open_thread)),
            open_author_context: Some(pair_callback(open_author_context)),
            copy_profile: Some(crate::profile_clipboard_host::profile_copy_provider()),
            copy_event_id: Some(crate::profile_clipboard_host::profile_copy_provider()),
            follow_profile: Some(follow_profile),
        },
    );
    Ok(ProfileIslandHandle {
        unmount: Some(Box::new(unmount)),
    })
}

fn optional_string(value: String) -> Option<String> {
    if value.is_empty() { None } else { Some(value) }
}

fn string_callback(function: Function) -> Callback<String> {
    Callback::new(move |value: String| {
        let _unused = function.call1(&JsValue::NULL, &JsValue::from_str(&value));
    })
}

fn function_field(actions: &JsValue, name: &str) -> Result<Function, JsValue> {
    Reflect::get(actions, &JsValue::from_str(name))?
        .dyn_into::<Function>()
        .map_err(|_| JsValue::from_str(&format!("Profile action {name} missing")))
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

fn unit_callback(function: Function) -> Callback<()> {
    Callback::new(move |()| {
        let _unused = function.call0(&JsValue::NULL);
    })
}
