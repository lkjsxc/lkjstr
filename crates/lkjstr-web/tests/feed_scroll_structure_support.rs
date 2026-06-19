#![cfg(target_arch = "wasm32")]
#![allow(dead_code)]

use wasm_bindgen::{JsCast, prelude::JsValue};

const TEST_STYLES: &str = concat!(
    include_str!("../../../src/styles/tokens.css"),
    "\n",
    include_str!("../../../src/styles/scroll-layout.css"),
);

pub fn assert_feed_scroll_boundary(
    feed_selector: &str,
    owner_selector: &str,
    contained_selectors: &[&str],
) -> Result<(), JsValue> {
    install_styles()?;
    let feed = required_element(feed_selector)?;
    let owners = feed.query_selector_all("[data-scroll-owner]")?;
    if owners.length() != 1 {
        return Err(js_error("feed did not render exactly one scroll owner"));
    }
    let owner = required_element(owner_selector)?;
    if !owner.has_attribute("data-scroll-owner") {
        return Err(js_error("scroll owner marker moved"));
    }
    for selector in contained_selectors {
        if owner.query_selector(selector)?.is_none() {
            return Err(js_error(&format!("{selector} outside scroll owner")));
        }
    }
    assert_vertical_scroller("scroll owner", &owner)?;
    assert_no_horizontal_overflow(&owner)?;
    assert_pane_body_not_scroll_owner(&feed)?;
    assert_no_nested_vertical_scroller(&feed, &owner)
}

pub fn assert_tab_body_not_scroll_owner(tab_selector: &str) -> Result<(), JsValue> {
    assert_not_vertical_scroller("tab body", &required_element(tab_selector)?)
}

fn assert_no_nested_vertical_scroller(
    feed: &web_sys::Element,
    owner: &web_sys::Element,
) -> Result<(), JsValue> {
    let mut current = parent_element(owner)?;
    while let Some(element) = current {
        if same_node(&element, feed)? {
            return Ok(());
        }
        assert_not_vertical_scroller("nested feed ancestor", &element)?;
        current = parent_element(&element)?;
    }
    Err(js_error("scroll owner is not inside feed-tab"))
}

fn assert_vertical_scroller(label: &str, element: &web_sys::Element) -> Result<(), JsValue> {
    let overflow = overflow_y(element)?;
    if matches!(overflow.as_str(), "auto" | "scroll") {
        return Ok(());
    }
    Err(js_error(&format!("{label} overflow-y is {overflow}")))
}

fn assert_not_vertical_scroller(label: &str, element: &web_sys::Element) -> Result<(), JsValue> {
    let overflow = overflow_y(element)?;
    if matches!(overflow.as_str(), "auto" | "scroll") {
        return Err(js_error(&format!("{label} is a competing scroller")));
    }
    Ok(())
}

fn assert_no_horizontal_overflow(element: &web_sys::Element) -> Result<(), JsValue> {
    let scroll_width = element.scroll_width();
    let client_width = element.client_width();
    if scroll_width <= client_width + 1 {
        return Ok(());
    }
    Err(js_error(&format!(
        "scroll owner has horizontal overflow: {scroll_width}>{client_width}"
    )))
}

fn assert_pane_body_not_scroll_owner(feed: &web_sys::Element) -> Result<(), JsValue> {
    let mut current = parent_element(feed)?;
    while let Some(element) = current {
        if has_class(&element, "pane-body") || has_class(&element, "lkjstr-pane-body") {
            return assert_not_vertical_scroller("pane body", &element);
        }
        current = parent_element(&element)?;
    }
    Err(js_error("missing pane body ancestor"))
}

fn has_class(element: &web_sys::Element, class_name: &str) -> bool {
    element
        .class_name()
        .split_whitespace()
        .any(|candidate| candidate == class_name)
}

fn overflow_y(element: &web_sys::Element) -> Result<String, JsValue> {
    let window = web_sys::window().ok_or_else(|| js_error("missing window"))?;
    let method = js_sys::Reflect::get(window.as_ref(), &JsValue::from_str("getComputedStyle"))?
        .dyn_into::<js_sys::Function>()?;
    let style = method.call1(window.as_ref(), element.as_ref())?;
    let getter = js_sys::Reflect::get(&style, &JsValue::from_str("getPropertyValue"))?
        .dyn_into::<js_sys::Function>()?;
    getter
        .call1(&style, &JsValue::from_str("overflow-y"))?
        .as_string()
        .ok_or_else(|| js_error("missing overflow-y"))
}

fn parent_element(element: &web_sys::Element) -> Result<Option<web_sys::Element>, JsValue> {
    let value = js_sys::Reflect::get(element.as_ref(), &JsValue::from_str("parentElement"))?;
    if value.is_null() || value.is_undefined() {
        return Ok(None);
    }
    value.dyn_into::<web_sys::Element>().map(Some)
}

fn same_node(left: &web_sys::Element, right: &web_sys::Element) -> Result<bool, JsValue> {
    let method = js_sys::Reflect::get(left.as_ref(), &JsValue::from_str("isSameNode"))?
        .dyn_into::<js_sys::Function>()?;
    Ok(method
        .call1(left.as_ref(), right.as_ref())?
        .as_bool()
        .unwrap_or(false))
}

fn required_element(selector: &str) -> Result<web_sys::Element, JsValue> {
    document()?
        .query_selector(selector)?
        .ok_or_else(|| js_error(&format!("missing selector: {selector}")))
}

fn install_styles() -> Result<(), JsValue> {
    let document = document()?;
    if document
        .get_element_by_id("feed-scroll-structure-css")
        .is_some()
    {
        return Ok(());
    }
    let style = document.create_element("style")?;
    style.set_id("feed-scroll-structure-css");
    style.set_text_content(Some(TEST_STYLES));
    document
        .head()
        .ok_or_else(|| js_error("missing document head"))?
        .append_child(&style)?;
    Ok(())
}

fn document() -> Result<web_sys::Document, JsValue> {
    web_sys::window()
        .and_then(|window| window.document())
        .ok_or_else(|| js_error("missing browser document"))
}

fn js_error(message: &str) -> JsValue {
    JsValue::from_str(message)
}
