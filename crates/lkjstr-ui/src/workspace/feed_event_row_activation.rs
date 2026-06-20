use leptos::{
    ev::{KeyboardEvent, MouseEvent},
    prelude::Callback,
};

#[cfg(target_arch = "wasm32")]
use leptos::wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use web_sys::{Element, EventTarget, Node};

#[cfg(any(target_arch = "wasm32", test))]
const ROW_LOCAL_SELECTOR: &str =
    "button,a,input,textarea,select,form,audio,video,.event-action-zone";

pub(super) fn event_row_can_open_thread(open_thread: &Option<Callback<String>>) -> bool {
    open_thread.is_some()
}

pub(super) fn event_row_click_opens_thread(event: &MouseEvent) -> bool {
    event_row_click_policy(event_row_target_is_local(event))
}

pub(super) fn event_row_key_opens_thread(event: &KeyboardEvent) -> bool {
    event_row_key_policy(&event.key(), event_row_key_target_is_row(event))
}

fn event_row_click_policy(target_is_local: bool) -> bool {
    !target_is_local
}

fn event_row_key_policy(key: &str, target_is_row: bool) -> bool {
    key == "Enter" && target_is_row
}

#[cfg(target_arch = "wasm32")]
fn event_row_target_is_local(event: &MouseEvent) -> bool {
    let Some(target) = event.target() else {
        return false;
    };
    let Some(element) = event_target_element(target) else {
        return false;
    };
    element.closest(ROW_LOCAL_SELECTOR).ok().flatten().is_some()
}

#[cfg(not(target_arch = "wasm32"))]
fn event_row_target_is_local(_event: &MouseEvent) -> bool {
    false
}

#[cfg(target_arch = "wasm32")]
fn event_target_element(target: EventTarget) -> Option<Element> {
    if let Some(element) = target.dyn_ref::<Element>() {
        return Some(element.clone());
    }
    target.dyn_ref::<Node>().and_then(Node::parent_element)
}

#[cfg(target_arch = "wasm32")]
fn event_row_key_target_is_row(event: &KeyboardEvent) -> bool {
    event.target() == event.current_target()
}

#[cfg(not(target_arch = "wasm32"))]
fn event_row_key_target_is_row(_event: &KeyboardEvent) -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn row_thread_activation_requires_real_opener() {
        assert!(!event_row_can_open_thread(&None));
        assert!(event_row_can_open_thread(&Some(Callback::new(
            |_: String| {}
        ))));
    }

    #[test]
    fn row_clicks_ignore_local_controls() {
        assert!(event_row_click_policy(false));
        assert!(!event_row_click_policy(true));
        assert!(ROW_LOCAL_SELECTOR.contains("button"));
        assert!(ROW_LOCAL_SELECTOR.contains("a"));
        assert!(ROW_LOCAL_SELECTOR.contains("audio"));
        assert!(ROW_LOCAL_SELECTOR.contains("video"));
        assert!(ROW_LOCAL_SELECTOR.contains(".event-action-zone"));
    }

    #[test]
    fn row_keyboard_activation_is_enter_from_row_only() {
        assert!(event_row_key_policy("Enter", true));
        assert!(!event_row_key_policy(" ", true));
        assert!(!event_row_key_policy("Enter", false));
    }
}
