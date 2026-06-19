#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use wasm_bindgen::{JsCast, prelude::JsValue};

pub fn home_scroll_owner() -> Result<web_sys::HtmlElement, JsValue> {
    required_element(".home-list-scroll")?
        .dyn_into::<web_sys::HtmlElement>()
        .map_err(|_| js_error("Home scroll owner is not an HtmlElement"))
}

pub fn event_row(value: u64) -> Result<web_sys::HtmlElement, JsValue> {
    required_element(&format!(
        ".lkjstr-feed-row.event[data-event-id='{}']",
        id(value)
    ))?
    .dyn_into::<web_sys::HtmlElement>()
    .map_err(|_| js_error("Home event row is not an HtmlElement"))
}

pub fn assert_visible_anchor(
    owner: &web_sys::HtmlElement,
    anchor: &web_sys::HtmlElement,
) -> Result<(), JsValue> {
    let top = relative_top(owner, anchor);
    let bottom = top.saturating_add(anchor.offset_height().max(1));
    let viewport_top = owner.scroll_top().max(0);
    let viewport_bottom = viewport_top.saturating_add(owner.client_height().max(0));
    if bottom > viewport_top && top < viewport_bottom {
        return Ok(());
    }
    Err(js_error(&format!(
        "visible event anchor moved out of viewport: top={top}, bottom={bottom}, viewport_top={viewport_top}, viewport_bottom={viewport_bottom}"
    )))
}

pub fn relative_top(owner: &web_sys::HtmlElement, row: &web_sys::HtmlElement) -> i32 {
    page_top(row).saturating_sub(page_top(owner))
}

fn page_top(element: &web_sys::HtmlElement) -> i32 {
    let mut top = element.offset_top();
    let mut parent = element.offset_parent();
    for _ in 0..16 {
        let Some(next) = parent.and_then(|node| node.dyn_into::<web_sys::HtmlElement>().ok())
        else {
            break;
        };
        top = top.saturating_add(next.offset_top());
        parent = next.offset_parent();
    }
    top
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector {selector}")))
}

fn id(value: u64) -> String {
    format!("{value:064x}")
}

pub fn js_error(message: &str) -> JsValue {
    js_sys::Error::new(message).into()
}
