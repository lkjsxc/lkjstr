use leptos::{html::Div, prelude::*};

#[cfg(target_arch = "wasm32")]
use leptos::wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};
#[cfg(target_arch = "wasm32")]
use web_sys::HtmlElement;

#[cfg(target_arch = "wasm32")]
use send_wrapper::SendWrapper;

#[cfg(target_arch = "wasm32")]
#[derive(Clone)]
pub(in crate::workspace::home) struct ResizeAnchorBatch {
    anchors: SendWrapper<Rc<RefCell<ResizeAnchors>>>,
    suppressed_scroll_top: SendWrapper<Rc<Cell<Option<i32>>>>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone)]
struct ResizeAnchor(String, i32, i32);

#[cfg(target_arch = "wasm32")]
#[derive(Default)]
struct ResizeAnchors {
    current: Option<ResizeAnchor>,
    previous: Option<ResizeAnchor>,
}

#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone, Default)]
pub(in crate::workspace::home) struct ResizeAnchorBatch;

pub(in crate::workspace::home) fn resize_anchor_batch() -> ResizeAnchorBatch {
    #[cfg(target_arch = "wasm32")]
    {
        ResizeAnchorBatch {
            anchors: SendWrapper::new(Rc::new(RefCell::new(ResizeAnchors::default()))),
            suppressed_scroll_top: SendWrapper::new(Rc::new(Cell::new(None))),
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        ResizeAnchorBatch
    }
}

impl ResizeAnchorBatch {
    pub(in crate::workspace::home) fn record_scroll_top(&self, scroll_node: NodeRef<Div>) {
        #[cfg(target_arch = "wasm32")]
        if let Some(owner) = scroll_node.get_untracked() {
            let top = owner.scroll_top().max(0);
            if let Some(suppressed) = self.suppressed_scroll_top.get() {
                if top == suppressed {
                    self.suppressed_scroll_top.set(None);
                    self.note_scroll_top(&owner);
                }
                return;
            }
            self.note_scroll_top(&owner);
        }

        #[cfg(not(target_arch = "wasm32"))]
        let _ = scroll_node;
    }

    #[cfg(target_arch = "wasm32")]
    pub(super) fn note_scroll_top(&self, owner: &HtmlElement) {
        let next = capture_viewport_anchor(owner);
        let mut anchors = self.anchors.borrow_mut();
        if anchors.current.as_ref().map(|value| value.0.as_str())
            != next.as_ref().map(|value| value.0.as_str())
        {
            anchors.previous = anchors.current.clone();
        }
        anchors.current = next;
    }

    #[cfg(target_arch = "wasm32")]
    pub(super) fn restore_anchor_except(
        &self,
        owner: &HtmlElement,
        excluded: Option<&str>,
    ) -> bool {
        let stored = self.anchors.borrow();
        for anchor in [stored.current.as_ref(), stored.previous.as_ref()]
            .into_iter()
            .flatten()
        {
            if Some(anchor.0.as_str()) != excluded && set_anchor_top(owner, anchor) {
                self.suppress_scroll_top(owner.scroll_top().max(0));
                return true;
            }
        }
        drop(stored);
        if let Some(anchor) = capture_viewport_anchor(owner) {
            if Some(anchor.0.as_str()) == excluded {
                return false;
            }
            let restored = set_anchor_top(owner, &anchor);
            if restored {
                self.suppress_scroll_top(owner.scroll_top().max(0));
            }
            return restored;
        }
        false
    }

    #[cfg(target_arch = "wasm32")]
    pub(super) fn scroll_top_except(&self, excluded: Option<&str>) -> Option<i32> {
        if let Some(scroll_top) = self.suppressed_scroll_top.get() {
            return Some(scroll_top);
        }
        let anchors = self.anchors.borrow();
        let mut scroll_top = None;
        for anchor in [anchors.current.as_ref(), anchors.previous.as_ref()]
            .into_iter()
            .flatten()
        {
            if Some(anchor.0.as_str()) != excluded {
                scroll_top = Some(scroll_top.unwrap_or(anchor.2).max(anchor.2));
            }
        }
        scroll_top
    }

    #[cfg(target_arch = "wasm32")]
    pub(super) fn suppress_scroll_top(&self, scroll_top: i32) {
        self.suppressed_scroll_top.set(Some(scroll_top.max(0)));
    }
}

#[cfg(target_arch = "wasm32")]
fn capture_viewport_anchor(owner: &HtmlElement) -> Option<ResizeAnchor> {
    let scroll_top = owner.scroll_top().max(0);
    (scroll_top != 0).then_some(())?;
    let rows = owner
        .query_selector_all(".lkjstr-feed-row-observer[data-observed-row-id]")
        .ok()?;
    let owner_top = page_top(owner);
    for index in 0..rows.length() {
        let row = rows.item(index)?.dyn_into::<HtmlElement>().ok()?;
        let top = page_top(&row).saturating_sub(owner_top);
        let bottom = top.saturating_add(row.offset_height().max(1));
        if bottom <= scroll_top {
            continue;
        }
        if top >= scroll_top || bottom.saturating_sub(scroll_top) > 2 {
            return Some(ResizeAnchor(
                row.get_attribute("data-observed-row-id")?,
                scroll_top.saturating_sub(top).max(0),
                scroll_top,
            ));
        }
    }
    None
}

#[cfg(target_arch = "wasm32")]
fn set_anchor_top(owner: &HtmlElement, anchor: &ResizeAnchor) -> bool {
    let Some(row) = find_row(owner, &anchor.0) else {
        return false;
    };
    let top = page_top(&row).saturating_sub(page_top(owner));
    owner.set_scroll_top(top.saturating_add(anchor.1));
    true
}

#[cfg(target_arch = "wasm32")]
fn find_row(owner: &HtmlElement, row_id: &str) -> Option<HtmlElement> {
    let rows = owner
        .query_selector_all(".lkjstr-feed-row-observer[data-observed-row-id]")
        .ok()?;
    for index in 0..rows.length() {
        let row = rows.item(index)?.dyn_into::<HtmlElement>().ok()?;
        if row.get_attribute("data-observed-row-id").as_deref() == Some(row_id) {
            return Some(row);
        }
    }
    None
}

#[cfg(target_arch = "wasm32")]
fn page_top(element: &HtmlElement) -> i32 {
    let mut top = element.offset_top();
    let mut parent = element.offset_parent();
    for _ in 0..16 {
        let Some(next) = parent.and_then(|node| node.dyn_into::<HtmlElement>().ok()) else {
            break;
        };
        top = top.saturating_add(next.offset_top());
        parent = next.offset_parent();
    }
    top
}
